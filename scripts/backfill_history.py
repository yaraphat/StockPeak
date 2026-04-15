#!/usr/bin/env python3
"""
Backfill 2 years of daily OHLCV for every active DSE ticker.

Idempotent + rate-limited. Safe to interrupt and re-run.

Usage:
    python3 backfill_history.py              # backfill all tickers needing refresh
    python3 backfill_history.py --ticker X   # just one ticker
    python3 backfill_history.py --days 365   # override default 730 days
"""

import argparse
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime, timedelta

import psycopg2
import psycopg2.extras

try:
    from bdshare import get_basic_historical_data
except ImportError:
    get_basic_historical_data = None


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("backfill_history")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
logger.addHandler(_fh)
logger.addHandler(logging.StreamHandler())

RATE_LIMIT_SEC = float(os.environ.get("BDSHARE_RATE_LIMIT", "1.0"))
STALE_DAYS = 7  # refresh backfill if older than this


def fetch_with_retry(ticker: str, start: str, end: str, max_retries: int = 3):
    """Fetch history with exponential backoff on bdshare errors."""
    for attempt in range(max_retries):
        try:
            df = get_basic_historical_data(start=start, end=end, code=ticker)
            if df is None or len(df) == 0:
                return None
            return df
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            logger.warning("Retry %d for %s after error: %s (sleep %ds)", attempt + 1, ticker, e, wait)
            time.sleep(wait)
    return None


def backfill_ticker(cur, ticker: str, days: int) -> int:
    """Backfill one ticker. Returns count of rows upserted."""
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    df = fetch_with_retry(ticker, start_date, end_date)
    if df is None or len(df) == 0:
        logger.warning("No history for %s", ticker)
        return 0

    count = 0
    for _, row in df.iterrows():
        try:
            dt = row.get("date") or row.get("DATE") or row.get("Date")
            if hasattr(dt, "strftime"):
                dt = dt.strftime("%Y-%m-%d")
            open_p = float(row.get("open") or row.get("OPEN") or 0)
            high = float(row.get("high") or row.get("HIGH") or 0)
            low = float(row.get("low") or row.get("LOW") or 0)
            close = float(row.get("close") or row.get("CLOSE") or 0)
            vol = int(row.get("volume") or row.get("VOLUME") or 0)
            if close <= 0:
                continue
            cur.execute(
                """
                INSERT INTO stock_data (date, ticker, open, high, low, close, volume)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (date, ticker) DO UPDATE SET
                  open = EXCLUDED.open,
                  high = EXCLUDED.high,
                  low = EXCLUDED.low,
                  close = EXCLUDED.close,
                  volume = EXCLUDED.volume
                """,
                (dt, ticker, open_p, high, low, close, vol),
            )
            count += 1
        except Exception as e:
            logger.warning("Row parse error for %s: %s", ticker, e)
            continue

    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", help="Backfill just this ticker")
    parser.add_argument("--days", type=int, default=730, help="Days to backfill (default 730)")
    parser.add_argument("--force", action="store_true", help="Re-backfill even if recently done")
    args = parser.parse_args()

    if get_basic_historical_data is None:
        logger.error("bdshare not installed; cannot backfill history")
        return 1

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set")
        return 1

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.ticker:
        tickers = [{"ticker": args.ticker.upper()}]
    else:
        # Pick tickers needing refresh
        if args.force:
            cur.execute("SELECT ticker FROM dse_stocks WHERE is_active = true ORDER BY ticker")
        else:
            cur.execute(
                """
                SELECT ticker FROM dse_stocks
                WHERE is_active = true
                  AND (last_backfilled_at IS NULL
                       OR last_backfilled_at < now() - interval '%s days')
                ORDER BY ticker
                """ % STALE_DAYS
            )
        tickers = cur.fetchall()

    if not tickers:
        logger.info("No tickers need backfill")
        return 0

    logger.info("Backfilling %d tickers (%d days each, rate %.1fs/req)...", len(tickers), args.days, RATE_LIMIT_SEC)
    total_rows = 0
    for i, t in enumerate(tickers, 1):
        ticker = t["ticker"]
        try:
            count = backfill_ticker(cur, ticker, args.days)
            conn.commit()
            # Mark backfilled
            cur.execute(
                "UPDATE dse_stocks SET last_backfilled_at = now() WHERE ticker = %s",
                (ticker,),
            )
            conn.commit()
            total_rows += count
            if i % 10 == 0 or i == len(tickers):
                logger.info("[%d/%d] %s: +%d rows (total %d)", i, len(tickers), ticker, count, total_rows)
        except Exception as e:
            logger.error("Failed %s: %s", ticker, e)
            conn.rollback()
        time.sleep(RATE_LIMIT_SEC)

    cur.close()
    conn.close()
    logger.info("Backfill complete: %d tickers, %d total rows", len(tickers), total_rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
