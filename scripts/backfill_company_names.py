#!/usr/bin/env python3
"""
One-off backfill for dse_stocks.company_name.

bdshare.get_current_trade_data() only returns symbol + OHLCV — no company
name — so sync_dse_stocks.py falls back to using the ticker as company_name,
and every row on the Stock Peak UI ends up showing the ticker twice.

This script scrapes www.dsebd.org/displayCompany.php?name=<TICKER> for every
ticker that has company_name = ticker and updates the row in place.

Rate-limited to 1 request/second (DSE is not a high-traffic target; we're
one of many small consumers). Idempotent: only hits rows where the current
name is still equal to the ticker, so re-running is safe.

Run from host:
    docker exec stockpeak env \
      DATABASE_URL='postgresql://stockpeak:stockpeak@127.0.0.1:5432/stockpeak' \
      python3 /app-scripts/backfill_company_names.py
"""

import os
import re
import sys
import time
from typing import Optional

import psycopg2
import requests

NAME_PATTERN = re.compile(r"Company Name[^<]*<[^>]*>([^<]+)</", re.I)
URL_TEMPLATE = "https://www.dsebd.org/displayCompany.php?name={ticker}"
REQ_TIMEOUT = 15
SLEEP_SECONDS = 1.0


def fetch_company_name(ticker: str) -> Optional[str]:
    try:
        r = requests.get(URL_TEMPLATE.format(ticker=ticker), timeout=REQ_TIMEOUT)
        if r.status_code != 200:
            return None
        m = NAME_PATTERN.search(r.text)
        if not m:
            return None
        name = m.group(1).strip()
        # Reject garbage (too short, too long, all-caps ticker-looking)
        if len(name) < 3 or len(name) > 200:
            return None
        if name == ticker:
            return None
        return name
    except Exception as e:
        print(f"  [warn] {ticker}: {type(e).__name__}: {e}", flush=True)
        return None


def main() -> int:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute(
        "SELECT ticker FROM dse_stocks "
        "WHERE company_name = ticker OR company_name IS NULL "
        "ORDER BY ticker"
    )
    tickers = [r[0] for r in cur.fetchall()]
    total = len(tickers)
    print(f"Backfilling {total} tickers at ~{1/SLEEP_SECONDS:.1f} req/s "
          f"(≈{int(total * SLEEP_SECONDS / 60)} min)...", flush=True)

    updated = 0
    failed = 0
    start = time.time()

    for i, ticker in enumerate(tickers, start=1):
        name = fetch_company_name(ticker)
        if name:
            cur.execute(
                "UPDATE dse_stocks SET company_name = %s, updated_at = now() "
                "WHERE ticker = %s",
                (name, ticker),
            )
            conn.commit()
            updated += 1
            if i % 20 == 0 or i == total:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed else 0
                eta = (total - i) / rate if rate else 0
                print(
                    f"  [{i}/{total}] ✓ {ticker} → {name}  "
                    f"(updated={updated}, failed={failed}, eta={int(eta)}s)",
                    flush=True,
                )
        else:
            failed += 1
            if i % 20 == 0:
                print(f"  [{i}/{total}] ✗ {ticker}: no name found", flush=True)

        time.sleep(SLEEP_SECONDS)

    cur.close()
    conn.close()

    elapsed = time.time() - start
    print(
        f"\nDone in {int(elapsed)}s: updated={updated}, failed={failed}, "
        f"total={total}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
