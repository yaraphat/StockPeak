#!/usr/bin/env python3
"""
Stock Peak Outcome Tracker
Runs daily after market close (after EOD summary).

For each pick still marked 'open', fetches historical OHLCV from pick date
to today and checks whether target or stop-loss was crossed first.
Marks expired after 30 calendar days if neither was hit.

Usage: python3 scripts/outcome_tracker.py
"""

import json
import logging
import logging.handlers
import os
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
from bdshare import get_basic_historical_data

LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("outcome_tracker")
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
EXPIRY_DAYS = 30  # Mark open picks as expired after this many days


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def fetch_ohlcv(ticker: str, from_date: str, to_date: str) -> pd.DataFrame | None:
    """Fetch daily OHLCV from bdshare between from_date and to_date (inclusive)."""
    try:
        hist = get_basic_historical_data(start=from_date, end=to_date, code=ticker)
        if hist is None or len(hist) == 0:
            return None
        for col in ["open", "high", "low", "close"]:
            if col in hist.columns:
                hist[col] = pd.to_numeric(hist[col], errors="coerce")
        # Ensure date column is parsed
        if "date" in hist.columns:
            hist["date"] = pd.to_datetime(hist["date"])
            hist = hist.sort_values("date")
        return hist
    except Exception as e:
        logger.warning("bdshare fetch failed for %s: %s", ticker, e)
        return None


def resolve_outcome(
    hist: pd.DataFrame,
    pick_date: str,
    target: float,
    stop_loss: float,
) -> dict | None:
    """
    Walk through OHLCV rows from pick_date onwards.
    Returns dict with outcome, exit_price, exit_date, gain_pct — or None if still open.

    Resolution rule:
      - On each day, check if the day's HIGH crossed target first, or LOW crossed stop first.
      - If open >= target → target hit at open (gap-up open past target)
      - If open <= stop_loss → stop hit at open (gap-down open past stop)
      - Otherwise check high vs target, low vs stop on same day:
          - If only high >= target → target hit (exit at target price)
          - If only low <= stop_loss → stop hit (exit at stop price)
          - If both crossed same day → whichever is closer to open wins
    """
    pick_dt = pd.Timestamp(pick_date)

    # Only look at bars AFTER the pick date (T+1 onwards, due to T+2 DSE settlement)
    future = hist[hist["date"] > pick_dt].copy()

    for _, row in future.iterrows():
        open_p = float(row.get("open", 0) or 0)
        high_p = float(row.get("high", 0) or 0)
        low_p = float(row.get("low", 0) or 0)
        exit_date = row["date"].strftime("%Y-%m-%d")

        # Gap past target on open
        if open_p >= target:
            exit_price = target  # conservative: assume filled at target
            return {
                "outcome": "target_hit",
                "exit_price": exit_price,
                "exit_date": exit_date,
                "gain_pct": round((exit_price - stop_loss) / stop_loss * 100, 2),
            }

        # Gap below stop on open
        if open_p > 0 and open_p <= stop_loss:
            exit_price = stop_loss
            return {
                "outcome": "stop_hit",
                "exit_price": exit_price,
                "exit_date": exit_date,
                "gain_pct": round((exit_price - stop_loss) / stop_loss * 100, 2),
            }

        hit_target = high_p >= target
        hit_stop = low_p <= stop_loss and low_p > 0

        if hit_target and not hit_stop:
            return {
                "outcome": "target_hit",
                "exit_price": round(target, 2),
                "exit_date": exit_date,
                "gain_pct": round((target - stop_loss) / stop_loss * 100, 2),
            }
        if hit_stop and not hit_target:
            return {
                "outcome": "stop_hit",
                "exit_price": round(stop_loss, 2),
                "exit_date": exit_date,
                "gain_pct": round((stop_loss - stop_loss) / stop_loss * 100, 2),
            }
        if hit_target and hit_stop:
            # Both on same candle — use distance from open to decide
            target_dist = abs(target - open_p)
            stop_dist = abs(stop_loss - open_p)
            if target_dist <= stop_dist:
                return {
                    "outcome": "target_hit",
                    "exit_price": round(target, 2),
                    "exit_date": exit_date,
                    "gain_pct": round((target - stop_loss) / stop_loss * 100, 2),
                }
            else:
                return {
                    "outcome": "stop_hit",
                    "exit_price": round(stop_loss, 2),
                    "exit_date": exit_date,
                    "gain_pct": round((stop_loss - stop_loss) / stop_loss * 100, 2),
                }

    return None  # Still open


def compute_gain_pct(entry: float, exit_price: float) -> float:
    if entry <= 0:
        return 0.0
    return round((exit_price - entry) / entry * 100, 2)


def main():
    logger.info("=== Outcome Tracker ===")
    logger.info("Time: %s", datetime.now().isoformat())

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    today = datetime.now().strftime("%Y-%m-%d")
    expiry_cutoff = (datetime.now() - timedelta(days=EXPIRY_DAYS)).strftime("%Y-%m-%d")

    # Fetch all open picks (excluding today — outcomes need at least 1 trading day)
    cur.execute("""
        SELECT
            p.id AS pick_id,
            p.date,
            p.ticker,
            p.buy_zone,
            p.target,
            p.stop_loss
        FROM picks p
        JOIN pick_outcomes po ON po.pick_id = p.id
        WHERE po.outcome = 'open'
          AND p.date < %s
        ORDER BY p.date ASC
    """, (today,))
    open_picks = cur.fetchall()

    logger.info("Found %d open picks to evaluate", len(open_picks))

    resolved = 0
    expired = 0
    still_open = 0

    for pick in open_picks:
        pick_id = str(pick["pick_id"])
        ticker = pick["ticker"]
        pick_date = pick["date"].strftime("%Y-%m-%d")
        entry = float(pick["buy_zone"])
        target = float(pick["target"])
        stop_loss = float(pick["stop_loss"])

        # Expire picks older than EXPIRY_DAYS
        if pick_date <= expiry_cutoff:
            cur.execute("""
                UPDATE pick_outcomes
                SET outcome = 'expired', updated_at = now()
                WHERE pick_id = %s AND outcome = 'open'
            """, (pick_id,))
            logger.info("  EXPIRED  %s (%s)", ticker, pick_date)
            expired += 1
            continue

        # Fetch OHLCV from pick date to today
        hist = fetch_ohlcv(ticker, pick_date, today)
        if hist is None or len(hist) == 0:
            logger.warning("  No history for %s from %s — skipping", ticker, pick_date)
            still_open += 1
            continue

        result = resolve_outcome(hist, pick_date, target, stop_loss)

        if result:
            gain = compute_gain_pct(entry, result["exit_price"])
            cur.execute("""
                UPDATE pick_outcomes
                SET
                    outcome = %s,
                    exit_price = %s,
                    exit_date = %s,
                    gain_pct = %s,
                    updated_at = now()
                WHERE pick_id = %s AND outcome = 'open'
            """, (
                result["outcome"],
                result["exit_price"],
                result["exit_date"],
                gain,
                pick_id,
            ))
            icon = "✅" if result["outcome"] == "target_hit" else "🔴"
            logger.info(
                "  %s %s (%s) → %s on %s at ৳%.2f (%+.1f%%)",
                icon, ticker, pick_date, result["outcome"],
                result["exit_date"], result["exit_price"], gain,
            )
            resolved += 1
        else:
            logger.info("  ○  %s (%s) still open", ticker, pick_date)
            still_open += 1

    cur.close()
    conn.close()

    logger.info(
        "=== Done: %d resolved, %d expired, %d still open ===",
        resolved, expired, still_open,
    )


if __name__ == "__main__":
    main()
