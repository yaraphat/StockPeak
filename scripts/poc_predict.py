#!/usr/bin/env python3
"""
Stock Peak POC — Local prediction pipeline
Scrapes DSE data, runs technical screen using today's trade data,
outputs scored candidates for Claude Code to analyze.
"""

import json
import sys
from datetime import datetime

import pandas as pd
from bdshare import get_current_trade_data


def scrape_dse():
    """Get current DSE trade data for all stocks."""
    print("[1/3] Scraping DSE data...")
    df = get_current_trade_data()
    if df is None or len(df) == 0:
        print("ERROR: No DSE data available")
        sys.exit(1)

    for col in ["ltp", "high", "low", "close", "ycp", "change", "trade", "value", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df[df["volume"] > 0].copy()
    df = df[df["ltp"] > 0].copy()

    print(f"  Got {len(df)} actively traded stocks")
    return df


def technical_screen(df):
    """Screen stocks using today's trade data signals."""
    print("[2/3] Running technical screen...")

    candidates = []
    for _, row in df.iterrows():
        symbol = row["symbol"]
        ltp = float(row["ltp"])
        high = float(row["high"])
        low = float(row["low"])
        close = float(row["close"])
        ycp = float(row["ycp"])
        volume = int(row["volume"])
        value = float(row["value"])
        trades = int(row["trade"])
        change = float(row["change"])

        score = 0
        signals = []

        # 1. Positive change (bullish momentum)
        change_pct = (change / ycp * 100) if ycp > 0 else 0
        if change_pct > 0.5:
            score += 1
            signals.append(f"Up {change_pct:.1f}%")

        # 2. High volume (active interest) — value traded > 5M BDT
        if value > 5:
            score += 1
            signals.append(f"Value ৳{value:.1f}M")

        # 3. Closing near day's high (buying pressure)
        day_range = high - low
        if day_range > 0:
            close_position = (close - low) / day_range
            if close_position > 0.7:
                score += 1
                signals.append(f"Near high ({close_position:.0%})")

        # 4. Reasonable price range (not penny, not too expensive)
        if 15 <= ltp <= 800:
            score += 1
            signals.append("Good price range")

        # 5. Multiple trades (not illiquid)
        if trades > 100:
            score += 1
            signals.append(f"{trades} trades")

        candidates.append({
            "symbol": symbol,
            "ltp": ltp,
            "high": high,
            "low": low,
            "close": close,
            "ycp": ycp,
            "change_pct": round(change_pct, 2),
            "volume": volume,
            "value_mn": round(value, 2),
            "trades": trades,
            "score": score,
            "signals": signals,
        })

    # Sort by score desc, then value desc
    candidates.sort(key=lambda x: (x["score"], x["value_mn"]), reverse=True)
    top = candidates[:15]

    print(f"  Top 15 candidates (out of {len(df)}):\n")
    for i, c in enumerate(top, 1):
        print(f"  {i:2d}. {c['symbol']:12s}  ৳{c['ltp']:>8.2f}  Score: {c['score']}/5  {', '.join(c['signals'])}")

    return top


def main():
    print(f"{'='*60}")
    print(f"  STOCK PEAK — POC PREDICTION PIPELINE")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M BDT')}")
    print(f"{'='*60}\n")

    df = scrape_dse()
    candidates = technical_screen(df)

    # Market summary
    total_up = len(df[df["change"] > 0])
    total_down = len(df[df["change"] < 0])
    total_unchanged = len(df[df["change"] == 0])

    print(f"\n[3/3] Market Summary:")
    print(f"  Advancing: {total_up}  |  Declining: {total_down}  |  Unchanged: {total_unchanged}")
    mood = "bullish" if total_up > total_down * 1.2 else ("bearish" if total_down > total_up * 1.2 else "neutral")
    print(f"  Market Mood: {mood.upper()}")

    output = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "market_summary": {
            "total_traded": len(df),
            "advancing": int(total_up),
            "declining": int(total_down),
            "unchanged": int(total_unchanged),
            "mood": mood,
        },
        "candidates": candidates,
    }

    path = "/tmp/stockpeak-candidates.json"
    with open(path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  Candidates saved to {path}")
    print(f"{'='*60}")

    return output


if __name__ == "__main__":
    main()
