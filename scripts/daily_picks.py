#!/usr/bin/env python3
"""
Stock Peak Daily Picks Pipeline
Runs at 6:00 AM BDT (UTC+6) via GitHub Actions or Railway cron.

1. Scrape yesterday's EOD data from DSE
2. Run technical screen (AND logic, fallback to 3-of-5 scoring)
3. Send top candidates to Claude API for pick selection + reasoning
4. Validate picks (stop_loss < buy_zone < target, ticker exists)
5. Store in PostgreSQL
6. Deliver via email (Resend) and Telegram
"""

import os
import json
import sys
from datetime import datetime, timedelta
from typing import Any

import anthropic
import psycopg2
import psycopg2.extras
import requests

# --- Config ---
DATABASE_URL = os.environ["DATABASE_URL"]
CLAUDE_API_KEY = os.environ["CLAUDE_API_KEY"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn
claude = anthropic.Anthropic(api_key=CLAUDE_API_KEY)


def scrape_dse_data() -> list[dict]:
    """Scrape yesterday's EOD data from DSE. Uses bdshare or fallback scraper."""
    try:
        from bdshare import get_current_trading_code_ep

        data = get_current_trading_code_ep()
        if data is not None and len(data) > 0:
            return data.to_dict("records")
    except Exception as e:
        print(f"bdshare failed: {e}, trying fallback...")

    # Fallback: try dsebd.org direct scraping
    try:
        resp = requests.get(
            "https://dsebd.org/latest_share_price_scroll_l.php",
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        # Parse the HTML table (simplified)
        # In production, use BeautifulSoup for robust parsing
        print("WARNING: Fallback scraper not fully implemented. Use bdshare.")
        return []
    except Exception as e:
        print(f"Fallback scraper failed: {e}")
        return []


def calculate_indicators(stock: dict) -> dict[str, Any]:
    """Calculate technical indicators for a single stock.
    In production, use `ta` library with 50+ day history.
    For MVP, we use available EOD data."""
    # Placeholder: in production, fetch 50-day history from stock_data table
    return {
        "ticker": stock.get("TRADING_CODE", stock.get("ticker", "")),
        "close": float(stock.get("CLOSEP", stock.get("close", 0))),
        "volume": int(stock.get("VOLUME", stock.get("volume", 0))),
        "change_pct": float(stock.get("CHANGE", stock.get("change_pct", 0))),
        # These would come from ta library in production
        "rsi": 45,  # placeholder
        "above_sma50": True,  # placeholder
        "macd_cross": True,  # placeholder
        "volume_ratio": 1.5,  # placeholder
    }


def technical_screen(stocks: list[dict]) -> list[dict]:
    """Filter stocks using AND logic (all 5 criteria).
    Falls back to 3-of-5 scoring if fewer than 10 pass."""
    candidates = []

    for stock in stocks:
        indicators = calculate_indicators(stock)
        score = 0

        # 5 criteria
        if indicators["volume_ratio"] > 1.5:
            score += 1
        if 30 <= indicators["rsi"] <= 60:
            score += 1
        if indicators["above_sma50"]:
            score += 1
        if indicators["macd_cross"]:
            score += 1
        if indicators["change_pct"] > 0:  # sector momentum proxy
            score += 1

        indicators["screen_score"] = score
        if score == 5:
            candidates.append(indicators)

    # Fallback: if fewer than 10 pass AND logic, use 3-of-5 scoring
    if len(candidates) < 10:
        candidates = []
        for stock in stocks:
            indicators = calculate_indicators(stock)
            indicators["screen_score"] = sum(
                [
                    indicators["volume_ratio"] > 1.5,
                    30 <= indicators["rsi"] <= 60,
                    indicators["above_sma50"],
                    indicators["macd_cross"],
                    indicators["change_pct"] > 0,
                ]
            )
            if indicators["screen_score"] >= 3:
                candidates.append(indicators)

    # Sort by score descending, take top 20
    candidates.sort(key=lambda x: x["screen_score"], reverse=True)
    return candidates[:20]


def generate_picks(candidates: list[dict]) -> dict:
    """Send candidates to Claude API for pick selection and reasoning."""
    candidates_text = "\n".join(
        f"- {c['ticker']}: Close ৳{c['close']}, Volume ratio {c['volume_ratio']:.1f}x, "
        f"RSI {c['rsi']}, Screen score {c['screen_score']}/5"
        for c in candidates
    )

    response = claude.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"""You are a stock analysis AI for the Dhaka Stock Exchange (DSE).
Analyze these pre-screened candidates and select the best 3 stocks to recommend.

CANDIDATES:
{candidates_text}

For each of your 3 picks, provide:
1. ticker: the stock trading code
2. company_name: company name in English
3. company_name_bn: company name in Bengali
4. buy_zone: recommended entry price (near current close)
5. target: target price (5-15% above buy zone)
6. stop_loss: stop loss price (3-7% below buy zone)
7. confidence: 1-10 score (indicators aligned + your conviction)
8. conviction_modifier: -1 to +2 (your LLM conviction beyond indicators)
9. reasoning_bn: 2-3 sentence analysis in Bengali explaining WHY this stock
10. reasoning_en: same reasoning in English

Also provide:
- market_mood: "bullish", "neutral", or "bearish" for overall DSE
- market_mood_reason: 1 sentence explanation

Return as JSON:
{{
  "picks": [{{...}}, {{...}}, {{...}}],
  "market_mood": "...",
  "market_mood_reason": "..."
}}""",
            }
        ],
    )

    text = response.content[0].text
    # Extract JSON from response
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def validate_picks(picks: list[dict], valid_tickers: set[str]) -> list[dict]:
    """Validate pick sanity: stop_loss < buy_zone < target, ticker exists."""
    validated = []
    for pick in picks:
        ticker = pick.get("ticker", "")
        buy = float(pick.get("buy_zone", 0))
        target = float(pick.get("target", 0))
        stop = float(pick.get("stop_loss", 0))
        confidence = int(pick.get("confidence", 0))

        if ticker not in valid_tickers:
            print(f"WARN: ticker {ticker} not in DSE data, skipping")
            continue
        if not (stop < buy < target):
            print(f"WARN: invalid prices for {ticker}: stop={stop} buy={buy} target={target}")
            continue
        if not (1 <= confidence <= 10):
            pick["confidence"] = max(1, min(10, confidence))

        validated.append(pick)

    return validated


def store_picks(picks: list[dict], mood: str, mood_reason: str) -> list[str]:
    """Store picks in PostgreSQL. Returns list of pick IDs."""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    today = datetime.now().strftime("%Y-%m-%d")
    pick_ids = []

    for pick in picks:
        cur.execute("""
            INSERT INTO picks (date, ticker, company_name, company_name_bn,
                buy_zone, target, stop_loss, confidence,
                reasoning_bn, reasoning_en, market_mood, market_mood_reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            today, pick["ticker"], pick.get("company_name", ""),
            pick.get("company_name_bn", ""), pick["buy_zone"], pick["target"],
            pick["stop_loss"], pick["confidence"], pick.get("reasoning_bn", ""),
            pick.get("reasoning_en", ""), mood, mood_reason,
        ))
        pick_id = cur.fetchone()["id"]
        pick_ids.append(str(pick_id))

        cur.execute("""
            INSERT INTO pick_outcomes (pick_id, outcome) VALUES (%s, 'open')
        """, (pick_id,))

    cur.close()
    conn.close()
    return pick_ids


def send_telegram(picks: list[dict], mood: str, mood_reason: str):
    """Post daily picks to Telegram channel."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHANNEL_ID:
        print("Telegram not configured, skipping")
        return

    mood_emoji = {"bullish": "🟢", "neutral": "⚪", "bearish": "🔴"}
    emoji = mood_emoji.get(mood, "⚪")

    lines = [
        f"📊 *Stock Peak Daily Picks*",
        f"📅 {datetime.now().strftime('%B %d, %Y')}",
        f"",
        f"{emoji} *Market Mood: {mood.title()}*",
        f"_{mood_reason}_",
        f"",
    ]

    for i, pick in enumerate(picks, 1):
        lines.extend([
            f"*{i}. {pick['ticker']}*",
            f"   Buy: ৳{pick['buy_zone']:.2f} | Target: ৳{pick['target']:.2f}",
            f"   Stop: ৳{pick['stop_loss']:.2f} | Confidence: {pick['confidence']}/10",
            f"   _{pick.get('reasoning_bn', '')}_",
            f"",
        ])

    lines.append("_Stock Peak - শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়_")
    text = "\n".join(lines)

    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={
            "chat_id": TELEGRAM_CHANNEL_ID,
            "text": text,
            "parse_mode": "Markdown",
        },
        timeout=10,
    )
    print("Telegram sent")


def send_emails(picks: list[dict], mood: str, mood_reason: str):
    """Send daily picks email via Resend."""
    if not RESEND_API_KEY:
        print("Resend not configured, skipping emails")
        return

    # Get pro subscribers
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT email, name FROM users WHERE role = 'pro'")
    subscribers = cur.fetchall()
    cur.close()
    conn.close()

    if not subscribers:
        print("No pro subscribers, skipping emails")
        return

    mood_color = {"bullish": "#16A34A", "neutral": "#78716C", "bearish": "#DC2626"}

    picks_html = ""
    for pick in picks:
        gain_pct = ((pick["target"] - pick["buy_zone"]) / pick["buy_zone"] * 100)
        picks_html += f"""
        <div style="border:1px solid #E7E5E4;border-radius:8px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between">
            <div>
              <strong style="color:#0066CC;font-family:monospace">{pick['ticker']}</strong><br>
              <small style="color:#78716C">{pick.get('company_name_bn', '')}</small>
            </div>
            <div style="text-align:right;font-family:monospace">
              <strong>৳{pick['buy_zone']:.2f}</strong><br>
              <small style="color:#78716C">Target: ৳{pick['target']:.2f}</small>
            </div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #F5F5F4;display:flex;justify-content:space-between">
            <span style="color:#16A34A;font-weight:600">+{gain_pct:.1f}% upside</span>
            <span style="color:#78716C;font-family:monospace;font-size:12px">{pick['confidence']}/10</span>
          </div>
          <p style="color:#78716C;font-size:13px;margin-top:8px">{pick.get('reasoning_bn', '')}</p>
        </div>
        """

    html = f"""
    <div style="max-width:480px;margin:0 auto;font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#F8F6F4;padding:24px">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin-bottom:4px">Stock Peak Daily Picks</h1>
      <p style="color:#78716C;font-size:14px;margin-bottom:16px">{datetime.now().strftime('%B %d, %Y')}</p>
      <div style="background:rgba(22,163,74,0.06);padding:8px 16px;border-radius:8px;margin-bottom:16px">
        <span style="color:{mood_color.get(mood, '#78716C')};font-weight:600">{mood.title()}</span>
        <span style="color:#78716C;font-size:13px"> — {mood_reason}</span>
      </div>
      {picks_html}
      <p style="font-size:11px;color:#A8A29E;text-align:center;margin-top:24px">
        শিক্ষামূলক AI বিশ্লেষণ। বিনিয়োগ পরামর্শ নয়।
        <br><a href="{{{{unsubscribe_url}}}}" style="color:#A8A29E">Unsubscribe</a>
      </p>
    </div>
    """

    for sub in subscribers:
        requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": "Stock Peak <picks@stockpeak.com.bd>",
                "to": sub["email"],
                "subject": f"📊 আজকের পিক: {', '.join(p['ticker'] for p in picks)} | Stock Peak",
                "html": html,
            },
            timeout=10,
        )

    print(f"Emails sent to {len(subscribers)} subscribers")


def main():
    print(f"=== Stock Peak Daily Picks Pipeline ===")
    print(f"Time: {datetime.now().isoformat()}")

    # Step 1: Scrape DSE data
    print("\n[1/6] Scraping DSE data...")
    stocks = scrape_dse_data()
    if not stocks:
        print("ERROR: No DSE data available. Sending 'no picks today' notification.")
        # TODO: send notification to subscribers
        sys.exit(1)
    print(f"  Got {len(stocks)} stocks")
    valid_tickers = {s.get("TRADING_CODE", s.get("ticker", "")) for s in stocks}

    # Step 2: Technical screen
    print("\n[2/6] Running technical screen...")
    candidates = technical_screen(stocks)
    if len(candidates) < 3:
        print(f"WARNING: Only {len(candidates)} candidates passed screen")
    print(f"  {len(candidates)} candidates passed")

    # Step 3: Generate picks via Claude
    print("\n[3/6] Generating picks via Claude API...")
    result = generate_picks(candidates)
    picks = result.get("picks", [])
    mood = result.get("market_mood", "neutral")
    mood_reason = result.get("market_mood_reason", "")
    print(f"  Generated {len(picks)} picks, mood: {mood}")

    # Step 4: Validate
    print("\n[4/6] Validating picks...")
    picks = validate_picks(picks, valid_tickers)
    if len(picks) < 3:
        print(f"WARNING: Only {len(picks)} valid picks after validation")
    print(f"  {len(picks)} valid picks")

    # Step 5: Store in Supabase
    print("\n[5/6] Storing picks...")
    pick_ids = store_picks(picks, mood, mood_reason)
    print(f"  Stored {len(pick_ids)} picks")

    # Step 6: Deliver
    print("\n[6/6] Delivering picks...")
    send_telegram(picks, mood, mood_reason)
    send_emails(picks, mood, mood_reason)

    print(f"\n=== Pipeline complete ===")
    print(f"Picks: {', '.join(p['ticker'] for p in picks)}")
    print(f"Mood: {mood}")


if __name__ == "__main__":
    main()
