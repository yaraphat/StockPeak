#!/usr/bin/env python3
"""
DSE market operational state — dynamic, data-driven.

Replaces the old hardcoded DSE_HOLIDAYS_2026 list. The only structural
rule baked in is the BD trading week (Sun-Thu). Everything else —
holidays, strikes, emergency closures, surprise trading sessions — is
detected from live bdshare data.

Usage:
    from market_state import get_market_state, MarketState
    state, details = get_market_state()
    if state in (MarketState.OPEN, MarketState.CLOSED_FOR_TODAY):
        run_pipeline()
"""

import logging
import os
from datetime import datetime
from typing import Tuple

import psycopg2
import psycopg2.extras
import pytz

BDT = pytz.timezone("Asia/Dhaka")
logger = logging.getLogger(__name__)


class MarketState:
    """String constants for clarity."""
    OPEN = "open"                   # Trading right now (within market hours + data showing activity)
    CLOSED_FOR_TODAY = "closed"     # Was open today, trading window has passed
    CLOSED_HOLIDAY = "holiday"      # Structural close (weekend) OR no activity today
    UNKNOWN = "unknown"             # bdshare unreachable — can't decide


def get_market_state(now: datetime | None = None) -> Tuple[str, dict]:
    """
    Determine current DSE state from live data. No hardcoded holiday list.

    Returns (state, details_dict). Details include activity %, weekday, etc.

    Structural rule: Fri/Sat = always closed (BD trading week is Sun-Thu).
    Everything else is inferred from bdshare data: if >5% of listed stocks
    have traded today (volume > 0), the market was operational.
    """
    try:
        from bdshare import get_current_trade_data
    except ImportError:
        return MarketState.UNKNOWN, {"reason": "bdshare not installed"}

    if now is None:
        now = datetime.now(BDT)
    weekday = now.weekday()  # Mon=0 ... Sun=6
    weekday_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday]

    # Bangladesh DSE trades Sun-Thu only. Fri=4, Sat=5 are weekend.
    # This is structural, baked into DSE's charter — not a holiday.
    if weekday in (4, 5):
        return MarketState.CLOSED_HOLIDAY, {
            "reason": "weekend",
            "weekday": weekday_name,
        }

    # Fetch live snapshot. If bdshare is down, fall back to UNKNOWN.
    try:
        df = get_current_trade_data()
    except Exception as e:
        logger.warning("bdshare get_current_trade_data failed: %s", e)
        return MarketState.UNKNOWN, {"reason": f"bdshare error: {type(e).__name__}"}

    if df is None or len(df) == 0:
        return MarketState.UNKNOWN, {"reason": "empty response from bdshare"}

    # Count how many stocks have traded today. If <5%, market is closed
    # (surprise holiday, strike, system outage, etc.).
    total = len(df)
    active = int((df["volume"] > 0).sum()) if "volume" in df.columns else 0
    activity_pct = (active / total * 100) if total > 0 else 0.0

    details = {
        "weekday": weekday_name,
        "total_listed": total,
        "active_today": active,
        "activity_pct": round(activity_pct, 1),
    }

    if activity_pct < 5.0:
        return MarketState.CLOSED_HOLIDAY, {
            **details,
            "reason": "insufficient_activity",
        }

    # Market traded today. Are we currently in trading hours?
    # DSE: 10:00 AM - 14:30 PM BDT
    minute_of_day = now.hour * 60 + now.minute
    if 10 * 60 <= minute_of_day < 14 * 60 + 30:
        return MarketState.OPEN, details
    return MarketState.CLOSED_FOR_TODAY, details


def record_state(state: str, details: dict, db_url: str | None = None) -> None:
    """
    Persist today's observed state to market_state_log table.
    Best-effort; swallows errors.
    """
    db_url = db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS market_state_log (
                id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                observed_at  timestamptz DEFAULT now(),
                state        text NOT NULL,
                details      jsonb DEFAULT '{}'
            )
        """)
        cur.execute("""
            INSERT INTO market_state_log (state, details)
            VALUES (%s, %s)
        """, (state, psycopg2.extras.Json(details)))
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning("Failed to record market state: %s", e)


# CLI for debugging: python3 market_state.py
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    state, details = get_market_state()
    print(f"State: {state}")
    for k, v in details.items():
        print(f"  {k}: {v}")
    record_state(state, details)
