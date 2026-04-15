#!/usr/bin/env python3
"""
Sync DSE ticker master list into `dse_stocks` table.

Runs daily via notifier APScheduler (or ad-hoc). Pulls current trade data from bdshare,
UPSERTs every ticker/company into dse_stocks. New IPOs appear automatically next run.

Category mapping: bdshare returns it in the 'category' column when available.
"""

import logging
import logging.handlers
import os
import sys
from datetime import datetime

import psycopg2
import psycopg2.extras

try:
    from bdshare import get_current_trade_data
except ImportError:
    get_current_trade_data = None


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("sync_dse_stocks")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
logger.addHandler(_fh)
logger.addHandler(logging.StreamHandler())


def sync():
    if get_current_trade_data is None:
        logger.error("bdshare not installed; cannot sync dse_stocks")
        return 1

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set")
        return 1

    logger.info("Fetching current DSE trade data...")
    df = get_current_trade_data()
    if df is None or len(df) == 0:
        logger.error("No data returned from bdshare")
        return 1

    logger.info("Got %d rows from bdshare", len(df))

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    upserts = 0
    for _, row in df.iterrows():
        ticker = str(row.get("symbol") or row.get("SYMBOL") or "").strip().upper()
        if not ticker or len(ticker) > 20:
            continue
        company_name = str(row.get("company_name") or row.get("COMPANY_NAME") or ticker).strip()
        category = str(row.get("category") or row.get("CATEGORY") or "").strip().upper()
        if category not in ("A", "B", "N", "Z"):
            category = None

        cur.execute(
            """
            INSERT INTO dse_stocks (ticker, company_name, category, is_active, updated_at)
            VALUES (%s, %s, %s, true, now())
            ON CONFLICT (ticker) DO UPDATE SET
              company_name = EXCLUDED.company_name,
              category = EXCLUDED.category,
              is_active = true,
              updated_at = now()
            """,
            (ticker, company_name, category),
        )
        upserts += 1

    conn.commit()
    cur.close()
    conn.close()

    logger.info("Upserted %d tickers into dse_stocks", upserts)
    return 0


if __name__ == "__main__":
    sys.exit(sync())
