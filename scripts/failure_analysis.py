#!/usr/bin/env python3
"""
Stock Peak Daily Failure Analysis Logger.

Runs after outcome_tracker.py. For every pick that resolved today
(target_hit / stop_hit), writes a Markdown report to:
  ${LOG_DIR}/failure-analysis/YYYY-MM-DD.md

Logs the original AI prediction context (RSI, MACD, score, reasoning,
risk annotations) alongside the actual market outcome and gain%.
This file is the audit trail for retrospective analysis. No learning,
no auto-tuning — just durable, human-readable records.
"""

import json
import logging
import logging.handlers
import os
import sys
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
FAILURE_DIR = f"{LOG_DIR}/failure-analysis"
os.makedirs(FAILURE_DIR, exist_ok=True)

logger = logging.getLogger("failure_analysis")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_ch = logging.StreamHandler()
_ch.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_fh)
logger.addHandler(_ch)

DATABASE_URL = os.environ["DATABASE_URL"]


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def fetch_resolved_today(cur, run_date: str) -> list[dict]:
    """Picks whose outcome was updated today (resolved by outcome_tracker)."""
    cur.execute("""
        SELECT
            p.id AS pick_id,
            p.date AS pick_date,
            p.ticker,
            p.company_name,
            p.buy_zone,
            p.target,
            p.stop_loss,
            p.confidence,
            p.reasoning_en,
            p.reasoning_bn,
            p.market_mood,
            p.market_mood_reason,
            p.risk_annotations,
            po.outcome,
            po.exit_price,
            po.exit_date,
            po.gain_pct,
            po.updated_at
        FROM picks p
        JOIN pick_outcomes po ON po.pick_id = p.id
        WHERE po.outcome IN ('target_hit', 'stop_hit', 'expired')
          AND po.updated_at::date = %s
        ORDER BY po.outcome, p.ticker
    """, (run_date,))
    return cur.fetchall()


def fetch_pick_day_snapshot(cur, ticker: str, pick_date) -> dict | None:
    """Pull the per-stock indicator snapshot from dse_daily_snapshots."""
    cur.execute("""
        SELECT stocks, market_summary
        FROM dse_daily_snapshots
        WHERE snapshot_date = %s
    """, (pick_date,))
    row = cur.fetchone()
    if not row:
        return None
    stocks = row["stocks"]
    if isinstance(stocks, str):
        stocks = json.loads(stocks)
    for s in stocks:
        if s.get("symbol") == ticker:
            return {"stock": s, "market_summary": row["market_summary"]}
    return None


def render_pick_section(pick: dict, snapshot: dict | None) -> str:
    outcome = pick["outcome"]
    icon = {"target_hit": "✅", "stop_hit": "🔴", "expired": "⏱"}.get(outcome, "•")
    lines = [
        f"### {icon} {pick['ticker']} — {outcome.upper()}",
        "",
        f"- **Picked:** {pick['pick_date']}  ",
        f"- **Resolved:** {pick['exit_date']} (held {(pick['exit_date'] - pick['pick_date']).days} days)  ",
        f"- **Entry:** ৳{float(pick['buy_zone']):.2f} | **Target:** ৳{float(pick['target']):.2f} | **Stop:** ৳{float(pick['stop_loss']):.2f}  ",
        f"- **Exit:** ৳{float(pick['exit_price']):.2f} | **Gain:** {float(pick['gain_pct']):+.2f}%  ",
        f"- **AI confidence:** {pick['confidence']}/10  ",
        f"- **Market mood (pick day):** {pick['market_mood']} — {pick['market_mood_reason']}  ",
        "",
        "**AI reasoning at pick time:**",
        f"> {pick['reasoning_en']}",
        "",
    ]

    if snapshot:
        s = snapshot["stock"]
        macd = s.get("macd_data", {})
        bb = s.get("bollinger", {})
        vol = s.get("volume_analysis", {})
        lines.extend([
            "**Indicators on pick day:**",
            f"- LTP ৳{s.get('ltp', 0):.2f} | RSI-14 {s.get('rsi', 'N/A')} | Score {s.get('score', 0):+d} | Signal {s.get('signal', 'N/A')}  ",
            f"- MACD crossover: {macd.get('crossover', 'none')} | above signal: {macd.get('macd_above_signal', False)}  ",
            f"- Bollinger: {bb.get('position', 'N/A')} band | squeeze: {bb.get('squeeze', False)}  ",
            f"- Volume ratio (20d): {vol.get('ratio', 1):.1f}x | trend: {vol.get('trend', 'N/A')}  ",
            f"- ATR: {s.get('atr', 0):.2f} | Turnover: ৳{s.get('value_mn', 0):.1f}M  ",
            "",
        ])
    else:
        lines.append("_No DSE snapshot available for pick date (pre-snapshot era or missing)._\n")

    risk = pick.get("risk_annotations") or {}
    if isinstance(risk, str):
        risk = json.loads(risk)
    if risk:
        lines.append("**Risk-tier annotations:**")
        for tier in ("conservative", "moderate", "aggressive"):
            t = risk.get(tier)
            if t:
                lines.append(f"- {tier}: signal={t.get('signal', 'N/A')}, score={t.get('score', 0):+d}")
        lines.append("")

    if outcome == "stop_hit":
        lines.append("**⚠️ Failure note:** Stop hit. Review whether the bull case was supported by indicators above, "
                     "whether the stop was set too tight relative to ATR, or whether market mood deteriorated after entry.\n")
    elif outcome == "expired":
        lines.append("**⏱ Stalled:** Neither target nor stop hit within 30 days. Momentum thesis didn't play out.\n")

    return "\n".join(lines)


def render_report(run_date: str, picks: list[dict], snapshots: dict) -> str:
    targets = [p for p in picks if p["outcome"] == "target_hit"]
    stops = [p for p in picks if p["outcome"] == "stop_hit"]
    expired = [p for p in picks if p["outcome"] == "expired"]

    total = len(picks)
    win_rate = (len(targets) / total * 100) if total else 0
    avg_gain = sum(float(p["gain_pct"]) for p in picks) / total if total else 0

    header = [
        f"# Stock Peak — Failure Analysis {run_date}",
        "",
        f"**Resolved today:** {total}  ",
        f"**Targets hit:** {len(targets)} | **Stops hit:** {len(stops)} | **Expired:** {len(expired)}  ",
        f"**Win rate:** {win_rate:.1f}%  ",
        f"**Average gain:** {avg_gain:+.2f}%  ",
        "",
        "---",
        "",
    ]

    if not picks:
        header.append("_No picks resolved today._")
        return "\n".join(header)

    body = []
    for group_name, group in (("Targets Hit", targets), ("Stops Hit", stops), ("Expired", expired)):
        if not group:
            continue
        body.append(f"## {group_name} ({len(group)})\n")
        for pick in group:
            snap = snapshots.get((pick["ticker"], pick["pick_date"]))
            body.append(render_pick_section(pick, snap))
            body.append("---\n")

    return "\n".join(header + body)


def main():
    run_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    logger.info("=== Failure Analysis for %s ===", run_date)

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    picks = fetch_resolved_today(cur, run_date)
    logger.info("Found %d picks resolved on %s", len(picks), run_date)

    # Pre-fetch snapshots for all unique (ticker, pick_date) pairs
    snapshots = {}
    for p in picks:
        key = (p["ticker"], p["pick_date"])
        if key not in snapshots:
            snapshots[key] = fetch_pick_day_snapshot(cur, p["ticker"], p["pick_date"])

    cur.close()
    conn.close()

    report = render_report(run_date, picks, snapshots)
    out_path = f"{FAILURE_DIR}/{run_date}.md"
    with open(out_path, "w") as f:
        f.write(report)
    logger.info("Failure analysis written to %s (%d picks)", out_path, len(picks))


if __name__ == "__main__":
    main()
