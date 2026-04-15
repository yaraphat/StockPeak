#!/usr/bin/env python3
"""
Stock Peak Pick Storage + Delivery — Stage 3 of the daily picks pipeline.

Pure DB write + notification dispatch. NO LLM calls.

Input: picks envelope JSON on stdin (or --in path) from generate_picks_llm.py.
Action: validates picks, stores in PostgreSQL (idempotent), sends Telegram + email.
"""

import argparse
import json
import logging
import logging.handlers
import os
import sys
from datetime import datetime

import psycopg2
import psycopg2.extras
import requests

from db_notify import broadcast_notification


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("store_picks")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_ch = logging.StreamHandler(sys.stderr)
_ch.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_fh)
logger.addHandler(_ch)

DATABASE_URL = os.environ["DATABASE_URL"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def validate_picks(picks: list[dict], valid_tickers: set[str]) -> list[dict]:
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
    pick_date: str,
    mood: str,
    mood_reason: str,
    risk_annotations_map: dict[str, dict],
) -> list[str]:
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
            pick_date, ticker, pick.get("company_name", ""),
            pick.get("company_name_bn", ""), pick["buy_zone"], pick["target"],
            pick["stop_loss"], pick["confidence"], pick.get("reasoning_bn", ""),
            pick.get("reasoning_en", ""), mood, mood_reason,
            json.dumps(risk_annotations),
        ))
        row = cur.fetchone()
        if row:
            pick_ids.append(str(row["id"]))
            cur.execute("""
                INSERT INTO pick_outcomes (pick_id, outcome) VALUES (%s, 'open')
                ON CONFLICT DO NOTHING
            """, (row["id"],))
        else:
            logger.info("Pick %s already exists for %s, skipping (idempotent)", ticker, pick_date)

    cur.close()
    conn.close()
    logger.info("Stored %d new picks (of %d total)", len(pick_ids), len(picks))
    return pick_ids


def notify_picks(picks: list[dict], mood: str, mood_reason: str):
    """Broadcast daily picks as in-app notifications. Also flash-alerts high-confidence picks."""
    mood_emoji = {"bullish": "🟢", "neutral": "⚪", "bearish": "🔴"}.get(mood, "⚪")
    date_str = datetime.now().strftime("%B %d, %Y")

    # Daily picks broadcast
    tickers_str = ", ".join(p["ticker"] for p in picks)
    body = f"{mood_emoji} বাজার {mood.title()} — {tickers_str} | {mood_reason}"
    count = broadcast_notification(
        DATABASE_URL,
        ntype="daily_picks",
        title=f"আজকের পিক — {date_str}",
        body=body,
        data={
            "mood": mood,
            "picks": [
                {
                    "ticker": p["ticker"],
                    "buy_zone": float(p["buy_zone"]),
                    "target": float(p["target"]),
                    "stop_loss": float(p["stop_loss"]),
                    "confidence": int(p.get("confidence", 0)),
                    "reasoning_bn": p.get("reasoning_bn", ""),
                }
                for p in picks
            ],
        },
        severity="info",
    )
    logger.info("Daily picks notification → %d users", count)

    # Exceptional opportunity flash alert (confidence >= 8)
    exceptional = [p for p in picks if int(p.get("confidence", 0)) >= 8]
    for p in exceptional:
        gain_pct = (float(p["target"]) - float(p["buy_zone"])) / float(p["buy_zone"]) * 100
        exc_body = (
            f"Confidence {p['confidence']}/10 | "
            f"Buy ৳{p['buy_zone']:.2f} → Target ৳{p['target']:.2f} ({gain_pct:+.1f}%) | "
            f"Stop ৳{p['stop_loss']:.2f}"
        )
        broadcast_notification(
            DATABASE_URL,
            ntype="exceptional_opportunity",
            title=f"Exceptional Opportunity — {p['ticker']}",
            body=exc_body,
            ticker=p["ticker"],
            data={
                "ticker": p["ticker"],
                "buy_zone": float(p["buy_zone"]),
                "target": float(p["target"]),
                "stop_loss": float(p["stop_loss"]),
                "confidence": int(p.get("confidence", 0)),
                "gain_pct": round(gain_pct, 1),
                "reasoning_bn": p.get("reasoning_bn", ""),
            },
            severity="warning",
        )
        logger.info("Exceptional opportunity alert → %s (confidence %d)", p["ticker"], p["confidence"])


def send_emails(picks: list[dict], mood: str, mood_reason: str):
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", help="Read picks envelope from this file (default: stdin)")
    parser.add_argument("--no-deliver", action="store_true", help="Skip Telegram + email")
    args = parser.parse_args()

    logger.info("=== store_picks ===")
    raw = open(args.in_path).read() if args.in_path else sys.stdin.read()
    envelope = json.loads(raw)

    pick_date = envelope["date"]
    valid_tickers = set(envelope["valid_tickers"])
    risk_annotations_map = envelope["risk_annotations_map"]
    mood = envelope.get("market_mood", "neutral")
    mood_reason = envelope.get("market_mood_reason", "")

    picks = validate_picks(envelope.get("picks", []), valid_tickers)
    if not picks:
        logger.error("No valid picks after validation — pipeline stopping")
        sys.exit(4)
    logger.info("%d valid picks", len(picks))

    store_picks(picks, pick_date, mood, mood_reason, risk_annotations_map)

    if not args.no_deliver:
        notify_picks(picks, mood, mood_reason)
        send_emails(picks, mood, mood_reason)

    logger.info("=== store_picks complete: %s ===", ", ".join(p["ticker"] for p in picks))


if __name__ == "__main__":
    main()
