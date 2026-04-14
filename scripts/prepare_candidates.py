#!/usr/bin/env python3
"""
Stock Peak Candidate Preparation — Stage 1 of the daily picks pipeline.

Pure data prep, NO LLM calls. Loads broker_agent's report, snapshots the
real DSE data to PostgreSQL + filesystem (for historical analysis), and
selects the top candidates for downstream pick generation.

Output: writes a JSON envelope to stdout (or --out path) shaped as:
  {
    "date": "YYYY-MM-DD",
    "market_summary": {...},
    "candidates": [...top N stocks...],
    "valid_tickers": [...],
    "risk_annotations_map": {ticker: {...}}
  }
"""

import argparse
import json
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime

import psycopg2
import psycopg2.extras


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(f"{LOG_DIR}/dse-snapshots", exist_ok=True)

logger = logging.getLogger("prepare_candidates")
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
BROKER_REPORT_PATH = os.environ.get("BROKER_REPORT_PATH", "/tmp/stockpeak-broker-report.json")


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def load_broker_report(path: str = BROKER_REPORT_PATH) -> dict:
    if not os.path.exists(path):
        logger.error("Broker report not found at %s — run broker_agent.py first", path)
        sys.exit(1)

    age_minutes = (time.time() - os.path.getmtime(path)) / 60
    if age_minutes > 120:
        logger.warning("Broker report is %.0f minutes old (>120 min)", age_minutes)

    with open(path) as f:
        report = json.load(f)

    logger.info(
        "Loaded broker report: %s (%d stocks, mood: %s)",
        report.get("date"),
        len(report.get("stocks", [])),
        report.get("market_summary", {}).get("mood", "unknown"),
    )
    return report


def snapshot_dse_data(report: dict) -> None:
    """
    Persist the real DSE data + indicators for the day.
    Writes to BOTH the dse_daily_snapshots table (queryable) and a
    dated JSON file on disk (redundant cold archive).
    Idempotent on snapshot_date.
    """
    snapshot_date = report.get("date") or datetime.now().strftime("%Y-%m-%d")
    market_summary = report.get("market_summary", {})
    stocks = report.get("stocks", [])

    # Filesystem snapshot — cold archive, never overwritten
    fs_path = f"{LOG_DIR}/dse-snapshots/{snapshot_date}.json"
    if not os.path.exists(fs_path):
        with open(fs_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        logger.info("DSE snapshot written to %s", fs_path)
    else:
        logger.info("DSE snapshot file already exists at %s", fs_path)

    # DB snapshot — queryable, idempotent on date
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO dse_daily_snapshots (snapshot_date, market_summary, stocks, stock_count, source)
        VALUES (%s, %s, %s, %s, 'broker_agent')
        ON CONFLICT (snapshot_date) DO UPDATE SET
            market_summary = EXCLUDED.market_summary,
            stocks = EXCLUDED.stocks,
            stock_count = EXCLUDED.stock_count,
            captured_at = now()
    """, (
        snapshot_date,
        json.dumps(market_summary),
        json.dumps(stocks, default=str),
        len(stocks),
    ))
    cur.close()
    conn.close()
    logger.info("DSE snapshot persisted to dse_daily_snapshots (%s, %d stocks)", snapshot_date, len(stocks))


def select_candidates(report: dict, min_score: int = 2, top_n: int = 20) -> list[dict]:
    stocks = report.get("stocks", [])
    candidates = [s for s in stocks if s.get("score", 0) >= min_score]

    if len(candidates) < 5:
        logger.warning(
            "Only %d candidates at score >= %d, lowering threshold to score >= 0",
            len(candidates), min_score,
        )
        candidates = [s for s in stocks if s.get("score", 0) >= 0]

    candidates.sort(key=lambda x: x.get("score", 0), reverse=True)
    selected = candidates[:top_n]
    logger.info("Selected %d candidates (from %d stocks)", len(selected), len(stocks))
    return selected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", help="Write JSON envelope to this path instead of stdout")
    parser.add_argument("--top-n", type=int, default=20)
    parser.add_argument("--min-score", type=int, default=2)
    args = parser.parse_args()

    logger.info("=== prepare_candidates ===")
    report = load_broker_report()
    snapshot_dse_data(report)

    candidates = select_candidates(report, min_score=args.min_score, top_n=args.top_n)
    if len(candidates) < 3:
        logger.error("Only %d candidates — insufficient for picks", len(candidates))
        sys.exit(2)

    stocks = report.get("stocks", [])
    envelope = {
        "date": report.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "market_summary": report.get("market_summary", {}),
        "candidates": candidates,
        "valid_tickers": sorted({s["symbol"] for s in stocks}),
        "risk_annotations_map": {s["symbol"]: s.get("risk_annotations", {}) for s in stocks},
    }

    payload = json.dumps(envelope, default=str)
    if args.out:
        with open(args.out, "w") as f:
            f.write(payload)
        logger.info("Envelope written to %s (%d candidates)", args.out, len(candidates))
    else:
        sys.stdout.write(payload)
        sys.stdout.flush()


if __name__ == "__main__":
    main()
