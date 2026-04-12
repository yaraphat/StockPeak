#!/usr/bin/env python3
"""
Stock Peak Notification Engine — Phase 2
Long-running APScheduler process in a separate Docker container.

Schedule (Asia/Dhaka):
  06:05 — Pre-market brief (Mon-Thu, Fri if half-day)
  10:00, 10:30, 11:00, ..., 14:30 — Intraday monitor (every 30 min)
  15:30 — EOD summary
  Thu 16:00 — Weekly digest

State persistence: notification_schedule table in PostgreSQL.
Fallback: /var/log/stockpeak/last-run.txt if DB is unavailable.
"""

import json
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

import psycopg2
import psycopg2.extras
import requests

try:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
    APSCHEDULER_AVAILABLE = True
except ImportError:
    APSCHEDULER_AVAILABLE = False

import pytz

BDT = pytz.timezone("Asia/Dhaka")

# --- Logging ---
LOG_DIR = "/var/log/stockpeak"
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("notification_engine")
logger.setLevel(logging.INFO)

_file_handler = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/notification_engine.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_console_handler = logging.StreamHandler()
_console_handler.setFormatter(logging.Formatter("%(message)s"))

logger.addHandler(_file_handler)
logger.addHandler(_console_handler)

# --- Config ---
DATABASE_URL = os.environ["DATABASE_URL"]
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
OWNER_TELEGRAM_ID = os.environ.get("OWNER_TELEGRAM_ID", "")
BROKER_REPORT_PATH = os.environ.get("BROKER_REPORT_PATH", "/tmp/stockpeak-broker-report.json")
LAST_RUN_FALLBACK_PATH = f"{LOG_DIR}/last-run.txt"

# DSE Market holidays 2026 (BDT dates — hardcoded per DSE calendar + BD national holidays)
# Ad-hoc holidays added here when announced by BSEC.
DSE_HOLIDAYS_2026 = {
    "2026-02-21",  # Ekushey February / International Mother Language Day
    "2026-03-17",  # Birth of Sheikh Mujibur Rahman (observed)
    "2026-03-26",  # Independence Day
    "2026-04-14",  # Bengali New Year (Pohela Boishakh)
    "2026-04-15",  # Bengali New Year holiday
    "2026-05-01",  # May Day / Labour Day
    "2026-06-07",  # Eid ul-Adha (approx — confirm with BSEC)
    "2026-06-08",  # Eid ul-Adha holiday
    "2026-06-09",  # Eid ul-Adha holiday
    "2026-08-15",  # National Mourning Day
    "2026-10-20",  # Durga Puja (Bijoya Dashami — approx)
    "2026-12-16",  # Victory Day
    "2026-12-25",  # Christmas Day
    # Eid ul-Fitr approx — confirm with BSEC 1 month before
    "2026-03-30",  # Eid ul-Fitr day 1 (approx)
    "2026-03-31",  # Eid ul-Fitr day 2 (approx)
    "2026-04-01",  # Eid ul-Fitr day 3 (approx)
}


def is_market_open(dt: Optional[datetime] = None) -> bool:
    """Return True if DSE is open on the given date (default: today BDT)."""
    if dt is None:
        dt = datetime.now(BDT)
    date_str = dt.strftime("%Y-%m-%d")
    # DSE is open Mon-Thu (Fri is half-day but typically treated as closed for our purposes)
    # DSE trading: Sun-Thu in Bangladesh
    weekday = dt.weekday()  # Mon=0, Sun=6
    # Bangladesh week: Sun-Thu are trading days, Fri-Sat are weekend
    if weekday in (4, 5):  # Friday, Saturday
        return False
    if date_str in DSE_HOLIDAYS_2026:
        logger.info("Market holiday: %s", date_str)
        return False
    return True


def get_db() -> Optional[psycopg2.extensions.connection]:
    """Return DB connection or None if unavailable."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.error("PostgreSQL unavailable: %s", e)
        return None


def record_last_run(job_name: str, status: str):
    """Persist last_run to DB (primary) and file (fallback)."""
    now_iso = datetime.now(BDT).isoformat()

    # File fallback always written (lightweight, survives container restart)
    try:
        with open(LAST_RUN_FALLBACK_PATH, "a") as f:
            f.write(f"{now_iso} {job_name} {status}\n")
    except Exception as e:
        logger.warning("Could not write fallback last-run file: %s", e)

    conn = get_db()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("""
                UPDATE notification_schedule
                SET last_run_at = now(), last_status = %s, updated_at = now()
                WHERE job_name = %s
            """, (status, job_name))
            cur.close()
            conn.close()
        except Exception as e:
            logger.warning("Could not update notification_schedule: %s", e)


def was_already_run_today(job_name: str) -> bool:
    """Check if this job already ran today (survives container restart)."""
    today = datetime.now(BDT).strftime("%Y-%m-%d")

    conn = get_db()
    if conn:
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT last_run_at FROM notification_schedule WHERE job_name = %s
            """, (job_name,))
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row and row["last_run_at"]:
                run_date = row["last_run_at"].astimezone(BDT).strftime("%Y-%m-%d")
                return run_date == today
        except Exception:
            pass

    # Fallback: check file
    try:
        if os.path.exists(LAST_RUN_FALLBACK_PATH):
            with open(LAST_RUN_FALLBACK_PATH) as f:
                for line in f:
                    if today in line and job_name in line and "success" in line:
                        return True
    except Exception:
        pass

    return False


def send_telegram_message(text: str, chat_id: Optional[str] = None, parse_mode: str = "Markdown") -> bool:
    """Send a Telegram message. Returns True on success."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set")
        return False

    target = chat_id or TELEGRAM_CHANNEL_ID
    if not target:
        logger.warning("No Telegram target (TELEGRAM_CHANNEL_ID not set)")
        return False

    for attempt in range(3):
        try:
            resp = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": target, "text": text, "parse_mode": parse_mode},
                timeout=10,
            )
            if resp.status_code == 200:
                return True
            logger.warning("Telegram returned %d: %s", resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("Telegram attempt %d failed: %s", attempt + 1, e)
        if attempt < 2:
            time.sleep(2 ** attempt)

    logger.error("All Telegram attempts failed")
    return False


def load_broker_report() -> Optional[dict]:
    """Load broker report. Returns None if missing or >120 min stale."""
    if not os.path.exists(BROKER_REPORT_PATH):
        logger.warning("Broker report not found at %s", BROKER_REPORT_PATH)
        return None

    age_minutes = (time.time() - os.path.getmtime(BROKER_REPORT_PATH)) / 60
    if age_minutes > 120:
        logger.warning("Broker report is %.0f min old (>120 min) — skipping notification", age_minutes)
        return None

    try:
        with open(BROKER_REPORT_PATH) as f:
            return json.load(f)
    except Exception as e:
        logger.error("Failed to load broker report: %s", e)
        return None


def get_todays_picks_from_db() -> list[dict]:
    """Fetch today's picks from PostgreSQL."""
    conn = get_db()
    if not conn:
        return []

    try:
        today = datetime.now(BDT).strftime("%Y-%m-%d")
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT ticker, company_name, company_name_bn, buy_zone, target,
                   stop_loss, confidence, reasoning_bn, market_mood, market_mood_reason
            FROM picks WHERE date = %s ORDER BY confidence DESC
        """, (today,))
        picks = [dict(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return picks
    except Exception as e:
        logger.error("Failed to fetch picks from DB: %s", e)
        return []


def log_notification(job_name: str, recipient_count: int, skipped_reason: Optional[str] = None):
    """Log delivery to notification_log table."""
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO notification_log
              (notification_type, scheduled_for, delivered_at, skipped_reason, recipient_count)
            VALUES (%s, now(), %s, %s, %s)
        """, (
            job_name,
            None if skipped_reason else datetime.now(BDT),
            skipped_reason,
            recipient_count,
        ))
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning("Failed to log notification: %s", e)


# ============================================================
# Scheduled jobs
# ============================================================

def job_pre_market_brief():
    """6:05 AM BDT — pre-market brief with today's picks and market mood."""
    job_name = "pre_market_brief"
    logger.info("[%s] Starting...", job_name)

    if not is_market_open():
        logger.info("[%s] Market closed today — skipping", job_name)
        log_notification(job_name, 0, skipped_reason="market_holiday")
        record_last_run(job_name, "skipped")
        return

    if was_already_run_today(job_name):
        logger.info("[%s] Already ran today — skipping", job_name)
        return

    report = load_broker_report()
    if report is None:
        logger.warning("[%s] No fresh broker report — skipping brief, retrying at 6:30 AM", job_name)
        log_notification(job_name, 0, skipped_reason="stale_data")
        record_last_run(job_name, "skipped")
        return

    picks = get_todays_picks_from_db()
    summary = report.get("market_summary", {})
    mood = summary.get("mood", "neutral")
    mood_emoji = {"bullish": "🟢", "neutral": "⚪", "bearish": "🔴"}.get(mood, "⚪")

    strong_buys = [s for s in report.get("stocks", []) if s.get("signal") == "STRONG BUY"]
    top_picks = sorted(strong_buys, key=lambda x: x.get("score", 0), reverse=True)[:3]

    lines = [
        "📊 *Stock Peak — Pre-Market Brief*",
        f"📅 {datetime.now(BDT).strftime('%A, %B %d, %Y')}",
        "",
        f"{mood_emoji} *Market Mood: {mood.title()}*",
        f"Advancing: {summary.get('advancing', '?')} | Declining: {summary.get('declining', '?')}",
        f"Total turnover: ৳{summary.get('total_turnover_mn', 0):.0f}M",
        "",
    ]

    if picks:
        lines.append("*আজকের পিক (Today's Picks):*")
        for p in picks[:3]:
            lines.extend([
                f"• *{p['ticker']}* — Buy ৳{p['buy_zone']:.2f} | Target ৳{p['target']:.2f} | Stop ৳{p['stop_loss']:.2f}",
                f"  _{p.get('reasoning_bn', '')}_",
            ])
    elif top_picks:
        lines.append("*Watchlist (STRONG BUY সংকেত):*")
        for s in top_picks:
            lines.append(f"• *{s['symbol']}* ৳{s['ltp']:.2f} — Score {s.get('score', 0):+d}")
    else:
        lines.append("_আজ কোনো স্ট্রং সংকেত নেই। বাজার পর্যবেক্ষণ করুন।_")

    lines.extend([
        "",
        "_Market opens 10:00 AM BDT_",
        "_Stock Peak — শিক্ষামূলক AI বিশ্লেষণ_",
    ])

    success = send_telegram_message("\n".join(lines))
    status = "success" if success else "error"
    log_notification(job_name, 1 if success else 0)
    record_last_run(job_name, status)
    logger.info("[%s] Done — %s", job_name, status)


def job_intraday_monitor():
    """Every 30 min 10:00-14:30 BDT — check stop-loss hits, volume spikes, target proximity."""
    job_name = "intraday_monitor"
    now = datetime.now(BDT)
    logger.info("[%s] %s", job_name, now.strftime("%H:%M"))

    if not is_market_open():
        return

    # Check data freshness before alerting
    if not os.path.exists(BROKER_REPORT_PATH):
        logger.warning("[%s] No broker report — skipping intraday check", job_name)
        return

    age_minutes = (time.time() - os.path.getmtime(BROKER_REPORT_PATH)) / 60
    if age_minutes > 60:
        logger.warning("[%s] Broker report %.0f min old — skipping to avoid stale alerts", job_name, age_minutes)
        return

    report = load_broker_report()
    if report is None:
        return

    current_prices = {s["symbol"]: s.get("ltp", 0) for s in report.get("stocks", [])}
    if not current_prices:
        return

    conn = get_db()
    if not conn:
        return

    try:
        today = now.strftime("%Y-%m-%d")
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Get active portfolio holdings with their pick stop_loss/target
        cur.execute("""
            SELECT
                ph.user_id,
                ph.ticker,
                ph.buy_price,
                ph.quantity,
                p.stop_loss AS pick_stop,
                p.target AS pick_target,
                u.telegram_chat_id
            FROM portfolio_holdings ph
            JOIN users u ON u.id = ph.user_id
            LEFT JOIN picks p ON p.ticker = ph.ticker AND p.date = (
                SELECT MAX(date) FROM picks WHERE ticker = ph.ticker
            )
            WHERE u.telegram_chat_id IS NOT NULL
        """)
        holdings = cur.fetchall()

        for h in holdings:
            ticker = h["ticker"]
            ltp = current_prices.get(ticker)
            if ltp is None or ltp == 0:
                continue

            chat_id = h["telegram_chat_id"]
            stop = float(h["pick_stop"]) if h["pick_stop"] else None
            target = float(h["pick_target"]) if h["pick_target"] else None
            buy = float(h["buy_price"])

            alerts = []

            # Stop-loss hit
            if stop and ltp <= stop:
                alerts.append({
                    "type": "stop_loss_hit",
                    "severity": "critical",
                    "msg": f"🚨 *{ticker} STOP LOSS HIT*\nCurrent: ৳{ltp:.2f} | Stop: ৳{stop:.2f}\n_বিক্রি করার কথা বিবেচনা করুন।_",
                })
            # Approaching stop (within 2%)
            elif stop and ltp <= stop * 1.02:
                alerts.append({
                    "type": "approaching_stop",
                    "severity": "warning",
                    "msg": f"⚠️ *{ticker} approaching stop-loss*\nCurrent: ৳{ltp:.2f} | Stop: ৳{stop:.2f}",
                })

            # Target hit
            if target and ltp >= target:
                alerts.append({
                    "type": "target_hit",
                    "severity": "info",
                    "msg": f"🎯 *{ticker} TARGET HIT!*\nCurrent: ৳{ltp:.2f} | Target: ৳{target:.2f}\n_মুনাফা বুক করার কথা বিবেচনা করুন।_",
                })

            # Large intraday move
            change_pct = next(
                (s.get("change_pct", 0) for s in report.get("stocks", []) if s["symbol"] == ticker),
                0,
            )
            if abs(change_pct) >= 5:
                direction = "📈" if change_pct > 0 else "📉"
                alerts.append({
                    "type": "price_move_5pct",
                    "severity": "warning" if change_pct < 0 else "info",
                    "msg": f"{direction} *{ticker}* {change_pct:+.1f}% today\nCurrent: ৳{ltp:.2f}",
                })

            for alert in alerts:
                send_telegram_message(alert["msg"], chat_id=chat_id)
                cur.execute("""
                    INSERT INTO alerts_log (user_id, alert_type, severity, message, channel, ticker)
                    VALUES (%s, %s, %s, %s, 'telegram', %s)
                """, (str(h["user_id"]), alert["type"], alert["severity"], alert["msg"], ticker))

        cur.close()
        conn.close()
        log_notification(job_name, len(holdings))
        record_last_run(job_name, "success")

    except Exception as e:
        logger.error("[%s] Error: %s", job_name, e)
        if conn:
            conn.close()


def run_outcome_tracker():
    """Run outcome_tracker.py as a subprocess after EOD."""
    import subprocess
    script = os.path.join(os.path.dirname(__file__), "outcome_tracker.py")
    try:
        result = subprocess.run(
            ["python3", script],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode != 0:
            logger.error("Outcome tracker failed:\n%s", result.stderr[-500:])
        else:
            logger.info("Outcome tracker completed:\n%s", result.stdout[-500:])
    except Exception as e:
        logger.error("Failed to run outcome tracker: %s", e)


def run_failure_analysis():
    """Run failure_analysis.py after the outcome tracker resolves picks."""
    import subprocess
    script = os.path.join(os.path.dirname(__file__), "failure_analysis.py")
    try:
        result = subprocess.run(
            ["python3", script],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            logger.error("Failure analysis failed:\n%s", result.stderr[-500:])
        else:
            logger.info("Failure analysis completed:\n%s", result.stdout[-500:])
    except Exception as e:
        logger.error("Failed to run failure analysis: %s", e)


def job_eod_summary():
    """3:30 PM BDT — EOD summary with day's P&L and pick performance."""
    job_name = "eod_summary"
    logger.info("[%s] Starting...", job_name)

    if not is_market_open():
        logger.info("[%s] Market closed today — skipping", job_name)
        log_notification(job_name, 0, skipped_reason="market_holiday")
        record_last_run(job_name, "skipped")
        return

    if was_already_run_today(job_name):
        logger.info("[%s] Already ran today — skipping", job_name)
        return

    report = load_broker_report()
    current_prices = {}
    if report:
        current_prices = {s["symbol"]: s.get("ltp", 0) for s in report.get("stocks", [])}
        summary = report.get("market_summary", {})
        mood = summary.get("mood", "neutral")
        mood_emoji = {"bullish": "🟢", "neutral": "⚪", "bearish": "🔴"}.get(mood, "⚪")
    else:
        mood = "neutral"
        mood_emoji = "⚪"

    picks = get_todays_picks_from_db()

    lines = [
        "📊 *Stock Peak — EOD Summary*",
        f"📅 {datetime.now(BDT).strftime('%B %d, %Y')} | Market Close",
        "",
    ]

    if report:
        lines.extend([
            f"{mood_emoji} *Market closed {mood.title()}*",
            "",
        ])

    if picks:
        lines.append("*আজকের পিক পারফরম্যান্স:*")
        for p in picks:
            ticker = p["ticker"]
            ltp = current_prices.get(ticker)
            if ltp and p.get("buy_zone"):
                pnl_pct = (ltp - float(p["buy_zone"])) / float(p["buy_zone"]) * 100
                icon = "🟢" if pnl_pct > 0 else ("🔴" if pnl_pct < -1 else "⚪")
                lines.append(
                    f"{icon} *{ticker}* — Entry ৳{p['buy_zone']:.2f} → Current ৳{ltp:.2f} ({pnl_pct:+.1f}%)"
                )
            else:
                lines.append(f"• *{ticker}* — Price data unavailable")
    else:
        lines.append("_আজ কোনো পিক ছিল না।_")

    lines.extend([
        "",
        "_Stock Peak — শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়_",
    ])

    success = send_telegram_message("\n".join(lines))
    status = "success" if success else "error"
    log_notification(job_name, 1 if success else 0)
    record_last_run(job_name, status)
    logger.info("[%s] Done — %s", job_name, status)

    # Run outcome tracker after EOD summary
    logger.info("[%s] Running outcome tracker...", job_name)
    run_outcome_tracker()

    # Then write the daily failure-analysis log to the filesystem
    logger.info("[%s] Running failure analysis...", job_name)
    run_failure_analysis()


def job_weekly_digest():
    """Thursday 4:00 PM BDT — weekly performance digest."""
    job_name = "weekly_digest"
    logger.info("[%s] Starting...", job_name)

    conn = get_db()
    if not conn:
        record_last_run(job_name, "error")
        return

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Last 7 days picks + outcomes
        cur.execute("""
            SELECT
                p.date, p.ticker, p.buy_zone, p.target, p.stop_loss, p.confidence,
                po.outcome, po.exit_price, po.gain_pct
            FROM picks p
            LEFT JOIN pick_outcomes po ON po.pick_id = p.id
            WHERE p.date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY p.date DESC, p.confidence DESC
        """)
        weekly_picks = cur.fetchall()
        cur.close()
        conn.close()

        closed = [p for p in weekly_picks if p["outcome"] in ("target_hit", "stop_hit")]
        hits = [p for p in closed if p["outcome"] == "target_hit"]
        hit_rate = len(hits) / len(closed) * 100 if closed else 0

        lines = [
            "📊 *Stock Peak — Weekly Digest*",
            f"📅 Week ending {datetime.now(BDT).strftime('%B %d, %Y')}",
            "",
            f"*এই সপ্তাহ:* {len(weekly_picks)} পিক | Hit rate: {hit_rate:.0f}%",
            "",
        ]

        if hits:
            lines.append("*✅ Target Hit:*")
            for p in hits[:5]:
                lines.append(
                    f"• {p['ticker']} — {p.get('gain_pct', 0):+.1f}% gain"
                )
            lines.append("")

        stop_hits = [p for p in closed if p["outcome"] == "stop_hit"]
        if stop_hits:
            lines.append("*🔴 Stop Hit:*")
            for p in stop_hits[:3]:
                lines.append(
                    f"• {p['ticker']} — {p.get('gain_pct', 0):+.1f}%"
                )
            lines.append("")

        lines.extend([
            "_আগামী সপ্তাহেও বাজার পর্যবেক্ষণ করুন।_",
            "_Stock Peak — শিক্ষামূলক AI বিশ্লেষণ_",
        ])

        success = send_telegram_message("\n".join(lines))
        status = "success" if success else "error"
        log_notification(job_name, 1 if success else 0)
        record_last_run(job_name, status)
        logger.info("[%s] Done — %s", job_name, status)

    except Exception as e:
        logger.error("[%s] Error: %s", job_name, e)


def job_pipeline_watchdog():
    """7:00 AM BDT — alert owner if daily_picks hasn't run yet."""
    if not OWNER_TELEGRAM_ID:
        return

    conn = get_db()
    today = datetime.now(BDT).strftime("%Y-%m-%d")

    has_picks = False
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM picks WHERE date = %s LIMIT 1", (today,))
            has_picks = cur.fetchone() is not None
            cur.close()
            conn.close()
        except Exception:
            pass

    if not has_picks and is_market_open():
        send_telegram_message(
            f"⚠️ *Pipeline Alert*\nNo picks for {today} by 7:00 AM BDT.\nCheck pipeline logs at {LOG_DIR}/pipeline.log",
            chat_id=OWNER_TELEGRAM_ID,
        )
        logger.warning("Watchdog: no picks for %s at 7:00 AM — owner alerted", today)


def main():
    if not APSCHEDULER_AVAILABLE:
        logger.error("APScheduler not installed. Run: pip install apscheduler pytz")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("  Stock Peak Notification Engine starting...")
    logger.info("  Timezone: Asia/Dhaka (BDT)")
    logger.info("=" * 60)

    scheduler = BlockingScheduler(timezone=BDT)

    # Pre-market brief: Mon-Thu + Sun (DSE trades Sun-Thu in Bangladesh) at 6:05 AM
    # 6:05 to give bdshare 5 extra minutes to update after midnight
    scheduler.add_job(
        job_pre_market_brief,
        CronTrigger(day_of_week="sun,mon,tue,wed,thu", hour=6, minute=5, timezone=BDT),
        id="pre_market_brief",
        name="Pre-Market Brief 6:05 AM",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Retry brief at 6:30 if data was stale at 6:05 (job is idempotent — won't re-send if already done)
    scheduler.add_job(
        job_pre_market_brief,
        CronTrigger(day_of_week="sun,mon,tue,wed,thu", hour=6, minute=30, timezone=BDT),
        id="pre_market_brief_retry",
        name="Pre-Market Brief retry 6:30 AM",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Intraday monitor: every 30 min 10:00-14:30 BDT (market hours)
    scheduler.add_job(
        job_intraday_monitor,
        CronTrigger(
            day_of_week="sun,mon,tue,wed,thu",
            hour="10,11,12,13,14",
            minute="0,30",
            timezone=BDT,
        ),
        id="intraday_monitor",
        name="Intraday Monitor",
        replace_existing=True,
        misfire_grace_time=120,
    )

    # EOD summary: 3:30 PM BDT (30 min after market close)
    scheduler.add_job(
        job_eod_summary,
        CronTrigger(day_of_week="sun,mon,tue,wed,thu", hour=15, minute=30, timezone=BDT),
        id="eod_summary",
        name="EOD Summary 3:30 PM",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Weekly digest: Thursday 4:00 PM BDT
    scheduler.add_job(
        job_weekly_digest,
        CronTrigger(day_of_week="thu", hour=16, minute=0, timezone=BDT),
        id="weekly_digest",
        name="Weekly Digest Thursday 4:00 PM",
        replace_existing=True,
        misfire_grace_time=600,
    )

    # Pipeline watchdog: 7:00 AM BDT (alerts owner if no picks by then)
    scheduler.add_job(
        job_pipeline_watchdog,
        CronTrigger(day_of_week="sun,mon,tue,wed,thu", hour=7, minute=0, timezone=BDT),
        id="pipeline_watchdog",
        name="Pipeline Watchdog 7:00 AM",
        replace_existing=True,
        misfire_grace_time=60,
    )

    logger.info("Scheduler jobs:")
    for job in scheduler.get_jobs():
        logger.info("  [%s] %s", job.id, job.name)

    logger.info("Starting scheduler. Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Notification engine stopped.")


if __name__ == "__main__":
    main()
