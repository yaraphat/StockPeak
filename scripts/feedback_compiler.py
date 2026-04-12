#!/usr/bin/env python3
"""
Stock Peak Feedback Compiler — aggregates structured performance stats.

Runs after failure_analysis.py in the EOD job. Reads resolved picks from
the DB, computes win rates, confidence calibration, indicator-outcome
correlations, per-ticker track records, and mood-performance stats.

Outputs ONLY structured stats — never raw scraped data, never stock names
from DSE feed as free text. This is the sanitization boundary that
prevents prompt injection into downstream skill proposals.

Stores results in the `feedback_reports` table.
"""

import json
import logging
import logging.handlers
import os
import sys
from collections import defaultdict
from datetime import datetime

import psycopg2
import psycopg2.extras


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("feedback_compiler")
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
MIN_SAMPLE_SIZE = int(os.environ.get("FEEDBACK_MIN_SAMPLE", "30"))


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def fetch_resolved_picks(cur) -> list[dict]:
    """All resolved picks with their outcome and original indicators from DSE snapshot."""
    cur.execute("""
        SELECT
            p.id, p.date AS pick_date, p.ticker, p.buy_zone, p.target, p.stop_loss,
            p.confidence, p.market_mood, p.risk_annotations,
            po.outcome, po.exit_price, po.exit_date, po.gain_pct,
            (po.exit_date - p.date) AS holding_days
        FROM picks p
        JOIN pick_outcomes po ON po.pick_id = p.id
        WHERE po.outcome IN ('target_hit', 'stop_hit', 'expired')
        ORDER BY p.date DESC
    """)
    return cur.fetchall()


def fetch_indicator_at_pick(cur, ticker: str, pick_date) -> dict | None:
    """Pull per-stock indicators from the DSE snapshot on pick date."""
    cur.execute("""
        SELECT stocks FROM dse_daily_snapshots WHERE snapshot_date = %s
    """, (pick_date,))
    row = cur.fetchone()
    if not row:
        return None
    stocks = row["stocks"]
    if isinstance(stocks, str):
        stocks = json.loads(stocks)
    for s in stocks:
        if s.get("symbol") == ticker:
            return s
    return None


def compile_stats(picks: list[dict], indicator_map: dict) -> dict:
    """Compile all structured performance stats from resolved picks."""
    total = len(picks)
    if total == 0:
        return {"total_resolved": 0}

    wins = [p for p in picks if p["outcome"] == "target_hit"]
    losses = [p for p in picks if p["outcome"] == "stop_hit"]
    expired = [p for p in picks if p["outcome"] == "expired"]

    win_rate = len(wins) / total

    gains = [float(p["gain_pct"]) for p in picks if p["gain_pct"] is not None]
    avg_gain = sum(gains) / len(gains) if gains else 0

    # Confidence calibration: group by confidence bucket, compute win rate per bucket
    conf_buckets = {"1-4": [], "5-7": [], "8-10": []}
    for p in picks:
        c = int(p["confidence"]) if p["confidence"] else 5
        if c <= 4:
            conf_buckets["1-4"].append(p)
        elif c <= 7:
            conf_buckets["5-7"].append(p)
        else:
            conf_buckets["8-10"].append(p)

    confidence_calibration = {}
    for bucket, bucket_picks in conf_buckets.items():
        if len(bucket_picks) >= 3:
            bucket_wins = sum(1 for p in bucket_picks if p["outcome"] == "target_hit")
            confidence_calibration[bucket] = {
                "sample": len(bucket_picks),
                "win_rate": round(bucket_wins / len(bucket_picks), 3),
            }

    # Indicator-outcome patterns
    indicator_patterns = []

    rsi_buckets = {"rsi_below_40": [], "rsi_40_55": [], "rsi_55_70": [], "rsi_above_70": []}
    for p in picks:
        ind = indicator_map.get((p["ticker"], p["pick_date"]))
        if not ind or ind.get("rsi") in (None, "N/A"):
            continue
        rsi = float(ind["rsi"])
        if rsi < 40:
            rsi_buckets["rsi_below_40"].append(p)
        elif rsi < 55:
            rsi_buckets["rsi_40_55"].append(p)
        elif rsi <= 70:
            rsi_buckets["rsi_55_70"].append(p)
        else:
            rsi_buckets["rsi_above_70"].append(p)

    for label, bucket_picks in rsi_buckets.items():
        if len(bucket_picks) >= 3:
            bucket_wins = sum(1 for p in bucket_picks if p["outcome"] == "target_hit")
            indicator_patterns.append({
                "condition": label.replace("_", " "),
                "sample": len(bucket_picks),
                "win_rate": round(bucket_wins / len(bucket_picks), 3),
            })

    # MACD crossover at pick time
    macd_groups = {"bullish_crossover": [], "bearish_crossover": [], "no_crossover": []}
    for p in picks:
        ind = indicator_map.get((p["ticker"], p["pick_date"]))
        if not ind:
            continue
        macd = ind.get("macd_data", {})
        crossover = macd.get("crossover", "none")
        if crossover == "bullish":
            macd_groups["bullish_crossover"].append(p)
        elif crossover == "bearish":
            macd_groups["bearish_crossover"].append(p)
        else:
            macd_groups["no_crossover"].append(p)

    for label, bucket_picks in macd_groups.items():
        if len(bucket_picks) >= 3:
            bucket_wins = sum(1 for p in bucket_picks if p["outcome"] == "target_hit")
            indicator_patterns.append({
                "condition": label.replace("_", " "),
                "sample": len(bucket_picks),
                "win_rate": round(bucket_wins / len(bucket_picks), 3),
            })

    # Volume ratio at pick time
    vol_groups = {"vol_below_1x": [], "vol_1x_2x": [], "vol_above_2x": []}
    for p in picks:
        ind = indicator_map.get((p["ticker"], p["pick_date"]))
        if not ind:
            continue
        vol = ind.get("volume_analysis", {}).get("ratio", 1)
        if vol < 1:
            vol_groups["vol_below_1x"].append(p)
        elif vol <= 2:
            vol_groups["vol_1x_2x"].append(p)
        else:
            vol_groups["vol_above_2x"].append(p)

    for label, bucket_picks in vol_groups.items():
        if len(bucket_picks) >= 3:
            bucket_wins = sum(1 for p in bucket_picks if p["outcome"] == "target_hit")
            indicator_patterns.append({
                "condition": label.replace("_", " "),
                "sample": len(bucket_picks),
                "win_rate": round(bucket_wins / len(bucket_picks), 3),
            })

    # Market mood at pick time
    mood_perf = defaultdict(lambda: {"picks": 0, "wins": 0, "losses": 0})
    for p in picks:
        mood = p.get("market_mood") or "unknown"
        mood_perf[mood]["picks"] += 1
        if p["outcome"] == "target_hit":
            mood_perf[mood]["wins"] += 1
        elif p["outcome"] == "stop_hit":
            mood_perf[mood]["losses"] += 1
    for mood in mood_perf:
        n = mood_perf[mood]["picks"]
        if n > 0:
            mood_perf[mood]["win_rate"] = round(mood_perf[mood]["wins"] / n, 3)
    mood_performance = dict(mood_perf)

    # Per-ticker track record
    ticker_perf = defaultdict(lambda: {"picks": 0, "wins": 0, "losses": 0, "gains": []})
    for p in picks:
        t = p["ticker"]
        ticker_perf[t]["picks"] += 1
        if p["outcome"] == "target_hit":
            ticker_perf[t]["wins"] += 1
        elif p["outcome"] == "stop_hit":
            ticker_perf[t]["losses"] += 1
        if p["gain_pct"] is not None:
            ticker_perf[t]["gains"].append(float(p["gain_pct"]))
    ticker_performance = {}
    for t, stats in ticker_perf.items():
        g = stats["gains"]
        ticker_performance[t] = {
            "picks": stats["picks"],
            "wins": stats["wins"],
            "losses": stats["losses"],
            "avg_gain": round(sum(g) / len(g), 2) if g else 0,
        }

    # Worst patterns: sort indicator_patterns by win_rate ascending
    worst = sorted(indicator_patterns, key=lambda x: x["win_rate"])[:3]

    holding_days = [int(p["holding_days"].days) for p in picks
                    if p.get("holding_days") and hasattr(p["holding_days"], "days")]
    avg_holding = round(sum(holding_days) / len(holding_days), 1) if holding_days else None

    return {
        "total_resolved": total,
        "wins": len(wins),
        "losses": len(losses),
        "expired": len(expired),
        "win_rate": round(win_rate, 3),
        "avg_gain_pct": round(avg_gain, 2),
        "avg_holding_days": avg_holding,
        "confidence_calibration": confidence_calibration,
        "indicator_patterns": indicator_patterns,
        "mood_performance": mood_performance,
        "ticker_performance": ticker_performance,
        "worst_patterns": worst,
    }


def store_report(cur, report_date: str, stats: dict) -> str | None:
    """Store compiled stats in feedback_reports. Returns report ID."""
    cur.execute("""
        INSERT INTO feedback_reports (
            report_date, period, total_resolved, win_rate, avg_gain_pct,
            confidence_calibration, indicator_patterns, mood_performance,
            ticker_performance, worst_patterns, raw_stats
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        report_date,
        f"all_{stats['total_resolved']}_resolved",
        stats["total_resolved"],
        stats.get("win_rate"),
        stats.get("avg_gain_pct"),
        json.dumps(stats.get("confidence_calibration", {})),
        json.dumps(stats.get("indicator_patterns", [])),
        json.dumps(stats.get("mood_performance", {})),
        json.dumps(stats.get("ticker_performance", {})),
        json.dumps(stats.get("worst_patterns", [])),
        json.dumps(stats),
    ))
    row = cur.fetchone()
    return str(row["id"]) if row else None


def main():
    report_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    logger.info("=== Feedback Compiler for %s ===", report_date)

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    picks = fetch_resolved_picks(cur)
    logger.info("Total resolved picks in DB: %d", len(picks))

    if len(picks) < MIN_SAMPLE_SIZE:
        logger.info(
            "Only %d resolved picks (need %d). Skipping feedback compilation.",
            len(picks), MIN_SAMPLE_SIZE,
        )
        cur.close()
        conn.close()
        return

    # Pre-fetch indicators for all (ticker, pick_date) pairs
    indicator_map = {}
    for p in picks:
        key = (p["ticker"], p["pick_date"])
        if key not in indicator_map:
            indicator_map[key] = fetch_indicator_at_pick(cur, p["ticker"], p["pick_date"])

    stats = compile_stats(picks, indicator_map)
    report_id = store_report(cur, report_date, stats)

    cur.close()
    conn.close()

    logger.info(
        "Feedback compiled: %d picks, win rate %.1f%%, avg gain %+.2f%%",
        stats["total_resolved"], stats["win_rate"] * 100, stats["avg_gain_pct"],
    )
    if stats.get("worst_patterns"):
        for wp in stats["worst_patterns"]:
            logger.info(
                "  Worst: %s — %d picks, %.0f%% win rate",
                wp["condition"], wp["sample"], wp["win_rate"] * 100,
            )
    logger.info("Report stored: %s", report_id)

    # Also write to filesystem for redundancy
    fs_path = f"{LOG_DIR}/feedback-reports/{report_date}.json"
    os.makedirs(os.path.dirname(fs_path), exist_ok=True)
    with open(fs_path, "w") as f:
        json.dump(stats, f, indent=2, default=str)
    logger.info("Feedback report written to %s", fs_path)


if __name__ == "__main__":
    main()
