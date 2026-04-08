#!/usr/bin/env python3
"""
Stock Peak AI Broker Agent — Data Pipeline
Scrapes all DSE stocks, computes technical indicators,
classifies each stock, and outputs structured data for
Claude Code to analyze as an expert broker.

Usage: python3 scripts/broker_agent.py
Then feed the output to Claude Code for expert analysis.
"""

import json
import sys
from datetime import datetime
from typing import Optional

import pandas as pd
import numpy as np
from bdshare import get_current_trade_data, get_basic_historical_data


def scrape_current_data() -> pd.DataFrame:
    """Get current DSE trade data for all stocks."""
    print("[1/5] Scraping current DSE trade data...")
    df = get_current_trade_data()
    if df is None or len(df) == 0:
        print("ERROR: No DSE data")
        sys.exit(1)

    for col in ["ltp", "high", "low", "close", "ycp", "change", "trade", "value", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["real_change"] = df["ltp"] - df["ycp"]
    df["change_pct"] = ((df["real_change"] / df["ycp"]) * 100).round(2)

    active = df[df["volume"] > 0].copy()
    print(f"  Total listed: {len(df)}, Actively traded: {len(active)}")
    return active


def fetch_history(symbol: str) -> Optional[pd.DataFrame]:
    """Fetch historical data for a symbol. Returns None on failure.
    Note: dsebd.org often times out. Agent works in degraded mode without history."""
    try:
        hist = get_basic_historical_data(symbol)
        if hist is not None and len(hist) >= 5:
            for col in ["open", "high", "low", "close", "volume"]:
                if col in hist.columns:
                    hist[col] = pd.to_numeric(hist[col], errors="coerce")
            return hist.tail(60)
    except Exception:
        pass
    return None


def compute_rsi(closes: pd.Series, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.inf)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return round(float(val), 1) if pd.notna(val) else 50.0


def compute_macd(closes: pd.Series) -> dict:
    if len(closes) < 26:
        return {"macd": 0, "signal": 0, "histogram": 0, "crossover": "none"}
    ema12 = closes.ewm(span=12).mean()
    ema26 = closes.ewm(span=26).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9).mean()
    histogram = macd_line - signal_line

    curr_hist = float(histogram.iloc[-1])
    prev_hist = float(histogram.iloc[-2]) if len(histogram) > 1 else 0

    crossover = "none"
    if prev_hist < 0 and curr_hist > 0:
        crossover = "bullish"
    elif prev_hist > 0 and curr_hist < 0:
        crossover = "bearish"

    return {
        "macd": round(float(macd_line.iloc[-1]), 3),
        "signal": round(float(signal_line.iloc[-1]), 3),
        "histogram": round(curr_hist, 3),
        "crossover": crossover,
    }


def compute_bollinger(closes: pd.Series, period: int = 20) -> dict:
    if len(closes) < period:
        return {"upper": 0, "middle": 0, "lower": 0, "position": "middle", "squeeze": False}
    sma = closes.rolling(window=period).mean()
    std = closes.rolling(window=period).std()
    upper = sma + 2 * std
    lower = sma - 2 * std

    curr_price = float(closes.iloc[-1])
    curr_upper = float(upper.iloc[-1])
    curr_lower = float(lower.iloc[-1])
    curr_middle = float(sma.iloc[-1])

    band_width = curr_upper - curr_lower
    avg_width = float((upper - lower).tail(60).mean()) if len(closes) >= 60 else band_width

    position = "middle"
    if curr_price >= curr_upper * 0.98:
        position = "upper"
    elif curr_price <= curr_lower * 1.02:
        position = "lower"

    return {
        "upper": round(curr_upper, 2),
        "middle": round(curr_middle, 2),
        "lower": round(curr_lower, 2),
        "position": position,
        "squeeze": band_width < avg_width * 0.6,
    }


def compute_moving_averages(closes: pd.Series) -> dict:
    result = {}
    for period in [9, 21, 50, 200]:
        if len(closes) >= period:
            result[f"ema_{period}"] = round(float(closes.ewm(span=period).mean().iloc[-1]), 2)
        else:
            result[f"ema_{period}"] = None
    return result


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    if len(close) < period + 1:
        return 0.0
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    val = atr.iloc[-1]
    return round(float(val), 2) if pd.notna(val) else 0.0


def compute_volume_analysis(volumes: pd.Series, current_volume: int) -> dict:
    if len(volumes) < 20:
        return {"avg_20d": 0, "ratio": 1.0, "trend": "unknown"}
    avg_20 = float(volumes.tail(20).mean())
    ratio = current_volume / avg_20 if avg_20 > 0 else 1.0

    recent_avg = float(volumes.tail(5).mean())
    older_avg = float(volumes.tail(20).head(15).mean())
    trend = "increasing" if recent_avg > older_avg * 1.2 else ("decreasing" if recent_avg < older_avg * 0.8 else "stable")

    return {
        "avg_20d": round(avg_20),
        "ratio": round(ratio, 2),
        "trend": trend,
    }


def classify_stock(indicators: dict) -> dict:
    """Classify a stock based on all indicators. Returns signal and confidence."""
    score = 0  # -10 to +10 scale
    reasons = []

    # Price vs MAs
    ltp = indicators["ltp"]
    ema_50 = indicators.get("ema_50")
    ema_200 = indicators.get("ema_200")
    ema_9 = indicators.get("ema_9")
    ema_21 = indicators.get("ema_21")

    if ema_50 and ltp > ema_50:
        score += 1
        reasons.append("Above EMA50")
    elif ema_50 and ltp < ema_50:
        score -= 1
        reasons.append("Below EMA50")

    if ema_200 and ltp > ema_200:
        score += 1
        reasons.append("Above EMA200 (long-term uptrend)")
    elif ema_200 and ltp < ema_200:
        score -= 1
        reasons.append("Below EMA200 (long-term downtrend)")

    if ema_9 and ema_21 and ema_9 > ema_21:
        score += 1
        reasons.append("EMA9 > EMA21 (short-term bullish)")
    elif ema_9 and ema_21 and ema_9 < ema_21:
        score -= 1
        reasons.append("EMA9 < EMA21 (short-term bearish)")

    # RSI
    rsi = indicators.get("rsi")
    if rsi is None:
        rsi = 50  # neutral default when no history
    if 40 <= rsi <= 60:
        score += 1
        reasons.append(f"RSI {rsi} (healthy range)")
    elif rsi > 70:
        score -= 1
        reasons.append(f"RSI {rsi} (OVERBOUGHT)")
    elif rsi < 30:
        score += 1  # oversold = potential reversal buy
        reasons.append(f"RSI {rsi} (OVERSOLD — potential reversal)")

    # MACD
    macd = indicators.get("macd_data", {})
    if macd.get("crossover") == "bullish":
        score += 2
        reasons.append("MACD bullish crossover")
    elif macd.get("crossover") == "bearish":
        score -= 2
        reasons.append("MACD bearish crossover")
    elif macd.get("histogram", 0) > 0:
        score += 1
        reasons.append("MACD histogram positive")
    elif macd.get("histogram", 0) < 0:
        score -= 1
        reasons.append("MACD histogram negative")

    # Bollinger
    bb = indicators.get("bollinger", {})
    if bb.get("squeeze"):
        reasons.append("Bollinger squeeze (breakout imminent)")
    if bb.get("position") == "lower" and rsi < 35:
        score += 2
        reasons.append("At lower Bollinger + oversold (strong buy signal)")
    elif bb.get("position") == "upper" and rsi > 65:
        score -= 1
        reasons.append("At upper Bollinger + overbought")

    # Volume
    vol = indicators.get("volume_analysis", {})
    if vol.get("ratio", 1) > 1.5:
        if indicators.get("change_pct", 0) > 0:
            score += 1
            reasons.append(f"Volume spike {vol['ratio']}x with price up")
        else:
            score -= 1
            reasons.append(f"Volume spike {vol['ratio']}x with price down (distribution)")

    # Today's price action
    change_pct = indicators.get("change_pct", 0)
    if change_pct >= 5:
        reasons.append(f"Strong up {change_pct}% today")
    elif change_pct <= -3:
        reasons.append(f"Down {change_pct}% today")

    # Close position in day's range
    high, low, close = indicators.get("high", 0), indicators.get("low", 0), indicators.get("close", 0)
    day_range = high - low
    if day_range > 0:
        close_pos = (close - low) / day_range
        if close_pos > 0.8:
            score += 1
            reasons.append("Closed near day high (buying pressure)")
        elif close_pos < 0.2:
            score -= 1
            reasons.append("Closed near day low (selling pressure)")

    # Liquidity check
    value_mn = indicators.get("value_mn", 0)
    if value_mn < 0.5:
        reasons.append("LOW LIQUIDITY — avoid")
        score = max(score, 0) - 2  # penalize illiquid stocks

    # Classify
    if score >= 4:
        signal = "STRONG BUY"
    elif score >= 2:
        signal = "BUY"
    elif score >= 0:
        signal = "HOLD"
    elif score >= -2:
        signal = "SELL"
    else:
        signal = "STRONG SELL"

    confidence = min(10, max(1, abs(score) + 3))

    # Calculate targets using ATR
    atr = indicators.get("atr", 0)
    if atr > 0 and signal in ("STRONG BUY", "BUY"):
        entry = ltp
        stop_loss = round(entry - 2.5 * atr, 2)
        target_1 = round(entry + 2 * atr, 2)
        target_2 = round(entry + 3.5 * atr, 2)
    elif atr > 0 and signal in ("SELL", "STRONG SELL"):
        entry = ltp
        stop_loss = round(entry + 2 * atr, 2)
        target_1 = round(entry - 2 * atr, 2)
        target_2 = round(entry - 3.5 * atr, 2)
    else:
        entry = ltp
        stop_loss = round(ltp * 0.95, 2)
        target_1 = round(ltp * 1.05, 2)
        target_2 = round(ltp * 1.10, 2)

    rr_ratio = abs(target_1 - entry) / abs(entry - stop_loss) if abs(entry - stop_loss) > 0 else 0

    return {
        "signal": signal,
        "score": score,
        "confidence": confidence,
        "reasons": reasons,
        "entry": entry,
        "stop_loss": stop_loss,
        "target_1": target_1,
        "target_2": target_2,
        "risk_reward": round(rr_ratio, 2),
    }


def main():
    start = datetime.now()
    print(f"{'='*70}")
    print(f"  STOCK PEAK AI BROKER AGENT — DATA PIPELINE")
    print(f"  {start.strftime('%Y-%m-%d %H:%M BDT')}")
    print(f"{'='*70}\n")

    # Step 1: Get current data
    df = scrape_current_data()

    # Step 2: Market breadth
    print("\n[2/5] Market breadth analysis...")
    advancing = len(df[df["real_change"] > 0])
    declining = len(df[df["real_change"] < 0])
    unchanged = len(df[df["real_change"] == 0])
    total_value = df["value"].sum()

    mood = "bullish" if advancing > declining * 1.3 else ("bearish" if declining > advancing * 1.3 else "neutral")
    print(f"  Advancing: {advancing} | Declining: {declining} | Unchanged: {unchanged}")
    print(f"  Total turnover: ৳{total_value:.0f}M")
    print(f"  Market Mood: {mood.upper()}")

    # Step 3: Compute indicators for top stocks by value
    print("\n[3/5] Analyzing top liquid stocks...")
    skip_history = "--no-history" in sys.argv  # Use flag to skip slow dsebd.org calls
    if skip_history:
        print("  (Skipping historical data — using current-day signals only)")

    df_sorted = df.sort_values("value", ascending=False)
    top_stocks = df_sorted.head(50)  # Analyze top 50 by turnover

    analyzed = []
    hist_success = 0
    for i, (_, row) in enumerate(top_stocks.iterrows()):
        symbol = row["symbol"]
        sys.stdout.write(f"\r  Analyzing {i+1}/50: {symbol:12s}")
        sys.stdout.flush()

        indicators = {
            "symbol": symbol,
            "ltp": float(row["ltp"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "ycp": float(row["ycp"]),
            "change_pct": float(row["change_pct"]),
            "volume": int(row["volume"]),
            "value_mn": round(float(row["value"]), 2),
            "trades": int(row["trade"]),
        }

        hist = None if skip_history else fetch_history(symbol)
        if hist is not None and len(hist) >= 14:
            hist_success += 1
            closes = hist["close"].dropna()
            highs = hist["high"].dropna()
            lows = hist["low"].dropna()
            volumes = hist["volume"].dropna() if "volume" in hist.columns else pd.Series()

            indicators["rsi"] = compute_rsi(closes)
            indicators["macd_data"] = compute_macd(closes)
            indicators.update(compute_moving_averages(closes))
            indicators["bollinger"] = compute_bollinger(closes)
            indicators["atr"] = compute_atr(highs, lows, closes)
            if len(volumes) > 0:
                indicators["volume_analysis"] = compute_volume_analysis(volumes, indicators["volume"])
            indicators["has_history"] = True
            indicators["history_days"] = len(closes)
        else:
            indicators["rsi"] = None
            indicators["macd_data"] = {}
            indicators["bollinger"] = {}
            indicators["atr"] = 0
            indicators["has_history"] = False

        classification = classify_stock(indicators)
        indicators.update(classification)
        analyzed.append(indicators)

    print(f"\r  Analyzed 50 stocks ({hist_success} with full history, {50-hist_success} current-day only)          ")

    # Step 4: Sort and categorize
    print("\n[4/5] Classification results:")

    strong_buys = [s for s in analyzed if s["signal"] == "STRONG BUY"]
    buys = [s for s in analyzed if s["signal"] == "BUY"]
    holds = [s for s in analyzed if s["signal"] == "HOLD"]
    sells = [s for s in analyzed if s["signal"] == "SELL"]
    strong_sells = [s for s in analyzed if s["signal"] == "STRONG SELL"]

    print(f"  STRONG BUY:  {len(strong_buys)}")
    print(f"  BUY:         {len(buys)}")
    print(f"  HOLD:        {len(holds)}")
    print(f"  SELL:        {len(sells)}")
    print(f"  STRONG SELL: {len(strong_sells)}")

    # Step 5: Output
    print(f"\n[5/5] Top recommendations:\n")

    print("  === STRONG BUY ===")
    for s in sorted(strong_buys, key=lambda x: x["score"], reverse=True)[:5]:
        print(f"  {s['symbol']:12s} ৳{s['ltp']:>8.2f}  {s['change_pct']:+5.1f}%  Score: {s['score']:+d}  Conf: {s['confidence']}/10  R:R {s['risk_reward']}")
        print(f"                 Entry: ৳{s['entry']}  T1: ৳{s['target_1']}  T2: ৳{s['target_2']}  SL: ৳{s['stop_loss']}")
        print(f"                 Reasons: {', '.join(s['reasons'][:4])}")
        print()

    print("  === BUY ===")
    for s in sorted(buys, key=lambda x: x["score"], reverse=True)[:5]:
        print(f"  {s['symbol']:12s} ৳{s['ltp']:>8.2f}  {s['change_pct']:+5.1f}%  Score: {s['score']:+d}  R:R {s['risk_reward']}")
        print(f"                 Reasons: {', '.join(s['reasons'][:3])}")
        print()

    print("  === SELL / AVOID ===")
    for s in sorted(sells + strong_sells, key=lambda x: x["score"])[:5]:
        print(f"  {s['symbol']:12s} ৳{s['ltp']:>8.2f}  {s['change_pct']:+5.1f}%  Score: {s['score']:+d}")
        print(f"                 Reasons: {', '.join(s['reasons'][:3])}")
        print()

    # Save full report
    report = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "generated_at": datetime.now().isoformat(),
        "market_summary": {
            "total_traded": len(df),
            "advancing": int(advancing),
            "declining": int(declining),
            "unchanged": int(unchanged),
            "total_turnover_mn": round(float(total_value), 1),
            "mood": mood,
        },
        "classification_summary": {
            "strong_buy": len(strong_buys),
            "buy": len(buys),
            "hold": len(holds),
            "sell": len(sells),
            "strong_sell": len(strong_sells),
        },
        "stocks": analyzed,
    }

    path = "/tmp/stockpeak-broker-report.json"
    with open(path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    elapsed = (datetime.now() - start).total_seconds()
    print(f"{'='*70}")
    print(f"  Full report: {path}")
    print(f"  Completed in {elapsed:.0f}s")
    print(f"{'='*70}")

    return report


if __name__ == "__main__":
    main()
