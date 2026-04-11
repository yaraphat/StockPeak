#!/usr/bin/env python3
"""
Stock Peak Portfolio Intelligence — Phase 3
Pre-computes VaR, correlation, and drawdown for all users with holdings.
Run daily after market close (e.g., 4:00 PM BDT) before EOD summary.

Output: portfolio_snapshots table in PostgreSQL.
"""

import json
import logging
import logging.handlers
import os
import sys
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import psycopg2
import psycopg2.extras

try:
    from bdshare import get_basic_historical_data
    BDSHARE_AVAILABLE = True
except ImportError:
    BDSHARE_AVAILABLE = False

# --- Logging ---
LOG_DIR = "/var/log/stockpeak"
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("portfolio_intelligence")
logger.setLevel(logging.INFO)

_file_handler = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_console_handler = logging.StreamHandler()
_console_handler.setFormatter(logging.Formatter("%(message)s"))

logger.addHandler(_file_handler)
logger.addHandler(_console_handler)

DATABASE_URL = os.environ["DATABASE_URL"]

# Alert thresholds
CORRELATION_ALERT_THRESHOLD = 0.70
DRAWDOWN_THRESHOLDS = [(-0.10, "drawdown_10"), (-0.15, "drawdown_15"), (-0.20, "drawdown_20")]
VAR_MIN_HISTORY_DAYS = 30
VAR_LOOKBACK_DAYS = 252


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def fetch_price_history(ticker: str, days: int = VAR_LOOKBACK_DAYS) -> Optional[list[float]]:
    """Fetch closing prices for a ticker. Returns list of closes or None."""
    if not BDSHARE_AVAILABLE:
        return None

    try:
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=days + 30)).strftime("%Y-%m-%d")
        hist = get_basic_historical_data(start=start, end=end, code=ticker)
        if hist is None or len(hist) < VAR_MIN_HISTORY_DAYS:
            return None

        import pandas as pd
        hist["close"] = pd.to_numeric(hist["close"], errors="coerce")
        closes = hist["close"].dropna().tolist()
        return closes[-days:] if len(closes) > days else closes
    except Exception as e:
        logger.warning("Failed to fetch history for %s: %s", ticker, e)
        return None


def compute_var_historical(
    holdings: list[dict], price_histories: dict[str, list[float]]
) -> dict:
    """
    Compute portfolio VaR (historical method, 95% confidence).

    holdings: list of {ticker, quantity, buy_price, current_price}
    price_histories: {ticker: [close_prices]}

    Returns: {var_95_pct, var_95_amount, correlation_matrix, note}
    """
    if len(holdings) <= 1:
        return {
            "var_95_pct": None,
            "var_95_amount": None,
            "correlation_matrix": None,
            "note": "Need at least 2 holdings for portfolio VaR",
        }

    tickers_with_history = [
        h for h in holdings
        if h["ticker"] in price_histories and price_histories[h["ticker"]] is not None
        and len(price_histories[h["ticker"]]) >= VAR_MIN_HISTORY_DAYS
    ]

    if len(tickers_with_history) < 2:
        return {
            "var_95_pct": None,
            "var_95_amount": None,
            "correlation_matrix": None,
            "note": f"Insufficient history: only {len(tickers_with_history)} holdings have {VAR_MIN_HISTORY_DAYS}+ days",
        }

    # Build returns matrix (align to shortest series)
    returns_list = []
    ticker_labels = []
    min_len = min(len(price_histories[h["ticker"]]) for h in tickers_with_history)

    for h in tickers_with_history:
        prices = np.array(price_histories[h["ticker"]][-min_len:])
        returns = np.diff(prices) / prices[:-1]
        returns_list.append(returns)
        ticker_labels.append(h["ticker"])

    returns_matrix = np.array(returns_list)  # shape: (n_assets, n_days-1)

    # Portfolio weights by current market value
    values = []
    for h in tickers_with_history:
        values.append(h["current_price"] * h["quantity"])
    total_value = sum(values)
    weights = np.array([v / total_value for v in values])

    # Portfolio daily returns
    portfolio_returns = weights @ returns_matrix  # shape: (n_days-1,)

    # Historical VaR at 95% confidence = 5th percentile of portfolio returns
    var_95_pct = float(np.percentile(portfolio_returns, 5))
    var_95_amount = var_95_pct * total_value

    # Correlation matrix
    if len(tickers_with_history) >= 2:
        corr = np.corrcoef(returns_matrix)
        corr_dict = {}
        for i, t1 in enumerate(ticker_labels):
            corr_dict[t1] = {}
            for j, t2 in enumerate(ticker_labels):
                corr_dict[t1][t2] = round(float(corr[i, j]), 3)
    else:
        corr_dict = None

    return {
        "var_95_pct": round(var_95_pct * 100, 3),  # as percentage
        "var_95_amount": round(var_95_amount, 2),
        "correlation_matrix": corr_dict,
        "note": f"Computed from {min_len} days of history for {len(tickers_with_history)} holdings",
    }


def compute_drawdown(current_total: float, peak_value: Optional[float]) -> tuple[float, float]:
    """Returns (max_drawdown_pct, new_peak_value)."""
    if peak_value is None or current_total > peak_value:
        return 0.0, current_total
    drawdown_pct = (current_total - peak_value) / peak_value * 100
    return round(drawdown_pct, 3), peak_value


def check_correlation_alerts(
    correlation_matrix: Optional[dict], user_id: str, conn
) -> list[dict]:
    """Insert alerts for high-correlation holding pairs."""
    if not correlation_matrix:
        return []

    alerts = []
    cur = conn.cursor()
    tickers = list(correlation_matrix.keys())

    for i in range(len(tickers)):
        for j in range(i + 1, len(tickers)):
            t1, t2 = tickers[i], tickers[j]
            corr = correlation_matrix.get(t1, {}).get(t2, 0)

            if abs(corr) >= CORRELATION_ALERT_THRESHOLD:
                severity = "critical" if abs(corr) >= 0.85 else "warning"
                msg = (
                    f"{t1} and {t2} are {abs(corr):.2f} correlated — "
                    "high concentration risk. Consider replacing one."
                    if abs(corr) >= 0.85
                    else f"{t1} and {t2} are {abs(corr):.2f} correlated — "
                    "portfolio diversification reduced."
                )

                cur.execute("""
                    INSERT INTO alerts_log
                      (user_id, alert_type, severity, message, channel)
                    VALUES (%s, %s, %s, %s, 'telegram')
                """, (user_id, "high_correlation", severity, msg))
                alerts.append({"ticker": f"{t1}/{t2}", "severity": severity, "message": msg})

    cur.close()
    return alerts


def process_user(user: dict, today: str, conn) -> bool:
    """Compute and store portfolio intelligence snapshot for one user."""
    user_id = str(user["id"])
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get current holdings
    cur.execute("""
        SELECT ticker, company_name, buy_price, quantity, buy_date
        FROM portfolio_holdings
        WHERE user_id = %s
    """, (user_id,))
    holdings_rows = cur.fetchall()

    if not holdings_rows:
        return False

    # Fetch current prices (use broker report if available, else buy_price as proxy)
    broker_report_path = os.environ.get("BROKER_REPORT_PATH", "/tmp/stockpeak-broker-report.json")
    current_prices = {}
    if os.path.exists(broker_report_path):
        try:
            with open(broker_report_path) as f:
                report = json.load(f)
            for s in report.get("stocks", []):
                current_prices[s["symbol"]] = s.get("ltp", s.get("close", 0))
        except Exception:
            pass

    holdings = []
    for row in holdings_rows:
        ticker = row["ticker"]
        current_price = current_prices.get(ticker, float(row["buy_price"]))
        holdings.append({
            "ticker": ticker,
            "company_name": row["company_name"],
            "buy_price": float(row["buy_price"]),
            "quantity": int(row["quantity"]),
            "current_price": current_price,
            "market_value": current_price * int(row["quantity"]),
            "unrealized_pnl": (current_price - float(row["buy_price"])) * int(row["quantity"]),
        })

    total_value = sum(h["market_value"] for h in holdings)
    daily_pnl = sum(h["unrealized_pnl"] for h in holdings)

    # Get previous peak value from last snapshot
    cur.execute("""
        SELECT peak_value FROM portfolio_snapshots
        WHERE user_id = %s
        ORDER BY snapshot_date DESC
        LIMIT 1
    """, (user_id,))
    prev = cur.fetchone()
    prev_peak = float(prev["peak_value"]) if prev and prev["peak_value"] else None

    drawdown_pct, new_peak = compute_drawdown(total_value, prev_peak)

    # Fetch price histories for VaR
    tickers = [h["ticker"] for h in holdings]
    price_histories = {t: fetch_price_history(t) for t in tickers}

    var_result = compute_var_historical(holdings, price_histories)

    # Store snapshot
    cur.execute("""
        INSERT INTO portfolio_snapshots (
            user_id, snapshot_date, total_value, daily_pnl,
            var_95_pct, var_95_amount, max_drawdown_pct, peak_value,
            correlation_matrix, holdings_snapshot
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
            total_value = EXCLUDED.total_value,
            daily_pnl = EXCLUDED.daily_pnl,
            var_95_pct = EXCLUDED.var_95_pct,
            var_95_amount = EXCLUDED.var_95_amount,
            max_drawdown_pct = EXCLUDED.max_drawdown_pct,
            peak_value = EXCLUDED.peak_value,
            correlation_matrix = EXCLUDED.correlation_matrix,
            holdings_snapshot = EXCLUDED.holdings_snapshot,
            computed_at = now()
    """, (
        user_id, today, total_value, daily_pnl,
        var_result.get("var_95_pct"),
        var_result.get("var_95_amount"),
        drawdown_pct,
        new_peak,
        json.dumps(var_result.get("correlation_matrix")),
        json.dumps(holdings),
    ))

    # Drawdown alerts
    for threshold, alert_type in DRAWDOWN_THRESHOLDS:
        if drawdown_pct / 100 <= threshold:
            severity = "emergency" if threshold <= -0.20 else "critical"
            msg = (
                f"Portfolio down {abs(drawdown_pct):.1f}% from peak (৳{new_peak:,.0f}). "
                f"Current value: ৳{total_value:,.0f}."
            )
            if threshold <= -0.20:
                msg += " Consider maximum defensive posture."
            elif threshold <= -0.15:
                msg += " Consider reducing equity exposure by 25%."
            else:
                msg += " Review and tighten stop-losses."

            cur.execute("""
                INSERT INTO alerts_log (user_id, alert_type, severity, message, channel)
                VALUES (%s, %s, %s, %s, 'telegram')
            """, (user_id, alert_type, severity, msg))
            break  # Only fire the most severe alert

    # Correlation alerts
    check_correlation_alerts(var_result.get("correlation_matrix"), user_id, conn)

    cur.close()
    logger.info(
        "  User %s: ৳%.0f total, %.1f%% drawdown, VaR %.2f%%",
        user_id[:8], total_value, drawdown_pct,
        var_result.get("var_95_pct") or 0,
    )
    return True


def main():
    logger.info("=== Portfolio Intelligence Pipeline ===")
    logger.info("Time: %s", datetime.now().isoformat())

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    today = datetime.now().strftime("%Y-%m-%d")

    # Get all users with holdings
    cur.execute("""
        SELECT DISTINCT u.id, u.email
        FROM users u
        INNER JOIN portfolio_holdings ph ON ph.user_id = u.id
    """)
    users = cur.fetchall()
    cur.close()

    logger.info("Processing %d users with holdings...", len(users))

    processed = 0
    for user in users:
        try:
            if process_user(user, today, conn):
                processed += 1
        except Exception as e:
            logger.error("Failed to process user %s: %s", user["id"], e)

    conn.close()
    logger.info("=== Portfolio Intelligence complete: %d/%d users ===", processed, len(users))


if __name__ == "__main__":
    main()
