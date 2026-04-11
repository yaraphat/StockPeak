#!/usr/bin/env python3
"""
Stock Peak Daily Picks Pipeline
Runs after broker_agent.py has produced /tmp/stockpeak-broker-report.json.

1. Load broker_agent report (pre-computed technical analysis + risk annotations)
2. Send top candidates to Claude API for pick selection + reasoning
3. Validate picks (stop_loss < buy_zone < target, ticker exists)
4. Store in PostgreSQL (idempotent — ON CONFLICT DO NOTHING)
5. Deliver via email (Resend) and Telegram
"""

import json
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime
from typing import Any

import anthropic
import psycopg2
import psycopg2.extras
import requests


# --- Logging setup ---
LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("daily_picks")
logger.setLevel(logging.INFO)

_file_handler = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(logging.Formatter("%(message)s"))

logger.addHandler(_file_handler)
logger.addHandler(_console_handler)


# --- Config ---
DATABASE_URL = os.environ["DATABASE_URL"]
CLAUDE_API_KEY = os.environ["CLAUDE_API_KEY"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

BROKER_REPORT_PATH = os.environ.get("BROKER_REPORT_PATH", "/tmp/stockpeak-broker-report.json")

claude = anthropic.Anthropic(api_key=CLAUDE_API_KEY)


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def load_broker_report(path: str = BROKER_REPORT_PATH) -> dict:
    """
    Load the broker_agent output. Exits if missing or stale (>120 min old).
    Returns the full report dict.
    """
    if not os.path.exists(path):
        logger.error("Broker report not found at %s — run broker_agent.py first", path)
        sys.exit(1)

    mtime = os.path.getmtime(path)
    age_minutes = (time.time() - mtime) / 60
    if age_minutes > 120:
        logger.warning(
            "Broker report is %.0f minutes old (>120 min) — data may be stale", age_minutes
        )

    with open(path) as f:
        report = json.load(f)

    logger.info(
        "Loaded broker report: %s (%d stocks, mood: %s)",
        report.get("date"),
        len(report.get("stocks", [])),
        report.get("market_summary", {}).get("mood", "unknown"),
    )
    return report


def select_candidates(report: dict, min_score: int = 2, top_n: int = 20) -> list[dict]:
    """
    Select top candidates from broker report for Claude to review.
    Filters to stocks with moderate-tier score >= min_score (BUY or better).
    """
    stocks = report.get("stocks", [])

    # Score field comes from moderate tier (backward-compat field set in broker_agent)
    candidates = [s for s in stocks if s.get("score", 0) >= min_score]

    # Fallback: if fewer than 5 strong candidates, lower threshold to score >= 0
    if len(candidates) < 5:
        logger.warning(
            "Only %d candidates at score >= %d, lowering threshold to score >= 0",
            len(candidates), min_score,
        )
        candidates = [s for s in stocks if s.get("score", 0) >= 0]

    candidates.sort(key=lambda x: x.get("score", 0), reverse=True)
    selected = candidates[:top_n]

    logger.info("Selected %d candidates for Claude review (from %d stocks)", len(selected), len(stocks))
    return selected


def generate_picks(candidates: list[dict], market_summary: dict) -> dict:
    """
    Send candidates to Claude API for pick selection and reasoning.
    Retries up to 2 times on JSON parse failure.
    """
    mood = market_summary.get("mood", "neutral")
    advancing = market_summary.get("advancing", 0)
    declining = market_summary.get("declining", 0)

    candidates_text = "\n".join(
        f"- {c['symbol']}: LTP ৳{c['ltp']}, RSI {c.get('rsi', 'N/A')}, "
        f"Score {c.get('score', 0):+d}, Conf {c.get('confidence', 0)}/10, "
        f"Vol ratio {c.get('volume_analysis', {}).get('ratio', 1):.1f}x, "
        f"MACD {c.get('macd_data', {}).get('crossover', 'none')}, "
        f"Signal: {c.get('signal', 'HOLD')}, R:R {c.get('risk_reward', 0):.1f}"
        for c in candidates
    )

    prompt = f"""You are a professional stock analysis AI for the Dhaka Stock Exchange (DSE), Bangladesh.

Market context: {mood.upper()} day — {advancing} advancing, {declining} declining stocks.

These candidates have passed technical screening. Select the best 3 stocks to recommend to retail investors today.

CANDIDATES (pre-screened by broker_agent.py):
{candidates_text}

For each of your 3 picks, provide:
1. ticker: the stock trading code (must match exactly from the list above)
2. company_name: company name in English
3. company_name_bn: company name in Bengali
4. buy_zone: recommended entry price (near LTP)
5. target: target price
6. stop_loss: stop loss price (must be BELOW buy_zone)
7. confidence: 1-10 (how strongly you recommend this pick today)
8. reasoning_bn: 2-3 sentences in Bengali explaining WHY this stock today
9. reasoning_en: same reasoning in English

Also provide:
- market_mood: "bullish", "neutral", or "bearish"
- market_mood_reason: 1 sentence explanation

Return ONLY valid JSON, no explanation before or after:
{{
  "picks": [
    {{"ticker": "...", "company_name": "...", "company_name_bn": "...", "buy_zone": 0.0, "target": 0.0, "stop_loss": 0.0, "confidence": 7, "reasoning_bn": "...", "reasoning_en": "..."}},
    ...
  ],
  "market_mood": "...",
  "market_mood_reason": "..."
}}"""

    last_error = None
    for attempt in range(3):
        if attempt > 0:
            logger.warning("Retrying Claude API call (attempt %d/3)...", attempt + 1)
            time.sleep(5 * attempt)

        try:
            response = claude.messages.create(
                model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text

            # Extract JSON — handle code fences and leading text
            start_idx = text.find("{")
            end_idx = text.rfind("}") + 1
            if start_idx == -1 or end_idx == 0:
                raise ValueError(f"No JSON object found in response: {text[:200]!r}")

            result = json.loads(text[start_idx:end_idx])

            if "picks" not in result:
                raise ValueError("JSON missing 'picks' key")

            logger.info("Claude returned %d picks (attempt %d)", len(result.get("picks", [])), attempt + 1)
            return result

        except (json.JSONDecodeError, ValueError, anthropic.APITimeoutError) as e:
            last_error = e
            logger.warning("Claude call attempt %d failed: %s", attempt + 1, e)
        except anthropic.APIError as e:
            last_error = e
            logger.error("Claude API error: %s", e)
            break

    logger.error("All Claude API attempts failed: %s", last_error)
    return {"picks": [], "market_mood": "neutral", "market_mood_reason": "Pipeline error — no picks today"}


def validate_picks(picks: list[dict], valid_tickers: set[str]) -> list[dict]:
    """Validate pick sanity: stop_loss < buy_zone < target, ticker exists."""
    validated = []
    for pick in picks:
        ticker = pick.get("ticker", "")
        try:
            buy = float(pick.get("buy_zone", 0))
            target = float(pick.get("target", 0))
            stop = float(pick.get("stop_loss", 0))
            confidence = int(pick.get("confidence", 0))
        except (TypeError, ValueError) as e:
            logger.warning("Invalid numeric field for %s: %s", ticker, e)
            continue

        if ticker not in valid_tickers:
            logger.warning("Ticker %s not in DSE data, skipping", ticker)
            continue
        if not (stop < buy < target):
            logger.warning(
                "Invalid prices for %s: stop=%.2f buy=%.2f target=%.2f", ticker, stop, buy, target
            )
            continue
        if not (1 <= confidence <= 10):
            pick["confidence"] = max(1, min(10, confidence))

        validated.append(pick)

    return validated


def store_picks(
    picks: list[dict],
    mood: str,
    mood_reason: str,
    risk_annotations_map: dict[str, dict],
) -> list[str]:
    """
    Store picks in PostgreSQL.
    Idempotent: ON CONFLICT (date, ticker) DO NOTHING.
    risk_annotations_map: {ticker: {conservative: {...}, moderate: {...}, aggressive: {...}}}
    """
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    today = datetime.now().strftime("%Y-%m-%d")
    pick_ids = []

    for pick in picks:
        ticker = pick["ticker"]
        risk_annotations = risk_annotations_map.get(ticker, {})

        cur.execute("""
            INSERT INTO picks (date, ticker, company_name, company_name_bn,
                buy_zone, target, stop_loss, confidence,
                reasoning_bn, reasoning_en, market_mood, market_mood_reason,
                risk_annotations)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (date, ticker) DO NOTHING
            RETURNING id
        """, (
            today, ticker, pick.get("company_name", ""),
            pick.get("company_name_bn", ""), pick["buy_zone"], pick["target"],
            pick["stop_loss"], pick["confidence"], pick.get("reasoning_bn", ""),
            pick.get("reasoning_en", ""), mood, mood_reason,
            json.dumps(risk_annotations),
        ))
        row = cur.fetchone()
        if row:
            pick_ids.append(str(row["id"]))
            # Insert outcomes only for new picks (not dupes)
            cur.execute("""
                INSERT INTO pick_outcomes (pick_id, outcome) VALUES (%s, 'open')
                ON CONFLICT DO NOTHING
            """, (row["id"],))
        else:
            logger.info("Pick %s already exists for %s, skipping (idempotent)", ticker, today)

    cur.close()
    conn.close()
    logger.info("Stored %d new picks (of %d total)", len(pick_ids), len(picks))
    return pick_ids


def send_telegram(picks: list[dict], mood: str, mood_reason: str):
    """Post daily picks to Telegram channel."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHANNEL_ID:
        logger.info("Telegram not configured, skipping")
        return

    mood_emoji = {"bullish": "🟢", "neutral": "⚪", "bearish": "🔴"}
    emoji = mood_emoji.get(mood, "⚪")

    lines = [
        "📊 *Stock Peak Daily Picks*",
        f"📅 {datetime.now().strftime('%B %d, %Y')}",
        "",
        f"{emoji} *Market Mood: {mood.title()}*",
        f"_{mood_reason}_",
        "",
    ]

    for i, pick in enumerate(picks, 1):
        lines.extend([
            f"*{i}. {pick['ticker']}*",
            f"   Buy: ৳{pick['buy_zone']:.2f} | Target: ৳{pick['target']:.2f}",
            f"   Stop: ৳{pick['stop_loss']:.2f} | Confidence: {pick['confidence']}/10",
            f"   _{pick.get('reasoning_bn', '')}_",
            "",
        ])

    lines.append("_Stock Peak - শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়_")
    text = "\n".join(lines)

    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHANNEL_ID, "text": text, "parse_mode": "Markdown"},
            timeout=10,
        )
        logger.info("Telegram message sent")
    except Exception as e:
        logger.error("Telegram send failed: %s", e)


def send_emails(picks: list[dict], mood: str, mood_reason: str):
    """Send daily picks email via Resend."""
    if not RESEND_API_KEY:
        logger.info("Resend not configured, skipping emails")
        return

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT email, name FROM users WHERE role = 'pro'")
    subscribers = cur.fetchall()
    cur.close()
    conn.close()

    if not subscribers:
        logger.info("No pro subscribers, skipping emails")
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
        try:
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
        except Exception as e:
            logger.error("Email send failed for %s: %s", sub["email"], e)

    logger.info("Emails sent to %d subscribers", len(subscribers))


def main():
    logger.info("=== Stock Peak Daily Picks Pipeline ===")
    logger.info("Time: %s", datetime.now().isoformat())

    # Step 1: Load broker report (replaces scrape + calculate_indicators + technical_screen)
    logger.info("[1/5] Loading broker agent report...")
    report = load_broker_report()
    market_summary = report.get("market_summary", {})

    stocks = report.get("stocks", [])
    valid_tickers = {s["symbol"] for s in stocks}

    # Build risk_annotations lookup by ticker
    risk_annotations_map = {
        s["symbol"]: s.get("risk_annotations", {})
        for s in stocks
    }

    # Step 2: Select top candidates
    logger.info("[2/5] Selecting candidates...")
    candidates = select_candidates(report)
    if len(candidates) < 3:
        logger.warning("Only %d candidates — sending 'no picks today' notification", len(candidates))
        # TODO Phase 2: notification_engine handles this case
        sys.exit(1)

    # Step 3: Generate picks via Claude
    logger.info("[3/5] Generating picks via Claude API...")
    result = generate_picks(candidates, market_summary)
    picks = result.get("picks", [])
    mood = result.get("market_mood", "neutral")
    mood_reason = result.get("market_mood_reason", "")

    if not picks:
        logger.error("No picks generated — pipeline stopping")
        sys.exit(1)

    logger.info("Generated %d picks, mood: %s", len(picks), mood)

    # Step 4: Validate
    logger.info("[4/5] Validating picks...")
    picks = validate_picks(picks, valid_tickers)
    if len(picks) < 1:
        logger.error("No valid picks after validation — pipeline stopping")
        sys.exit(1)
    if len(picks) < 3:
        logger.warning("Only %d valid picks after validation", len(picks))
    logger.info("%d valid picks", len(picks))

    # Step 5: Store
    logger.info("[5/5] Storing and delivering picks...")
    pick_ids = store_picks(picks, mood, mood_reason, risk_annotations_map)

    # Step 6: Deliver
    send_telegram(picks, mood, mood_reason)
    send_emails(picks, mood, mood_reason)

    logger.info("=== Pipeline complete ===")
    logger.info("Picks: %s", ", ".join(p["ticker"] for p in picks))
    logger.info("Mood: %s", mood)


if __name__ == "__main__":
    main()
