#!/usr/bin/env python3
"""
Stock Peak AI Broker Agent — Data Pipeline
Scrapes all DSE stocks, computes technical indicators,
classifies each stock per risk tier, and outputs structured
data for the daily_picks.py pipeline.

Usage: python3 scripts/broker_agent.py
Output: /tmp/stockpeak-broker-report.json
"""

import json
import logging
import logging.handlers
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import numpy as np
from bdshare import get_current_trade_data, get_basic_historical_data


# --- Logging setup ---
LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("broker_agent")
logger.setLevel(logging.INFO)

_file_handler = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(logging.Formatter("%(message)s"))

logger.addHandler(_file_handler)
logger.addHandler(_console_handler)


# --- Risk profile definitions ---
RISK_PROFILES = {
    "conservative": {
        "min_rsi": 35,
        "max_rsi": 60,
        "min_liquidity_mn": 5.0,
        "stop_loss_multiplier": 1.0,
        "target_multiplier": 2.0,
        "preferred_signals": ["STRONG BUY"],
    },
    "moderate": {
        "min_rsi": 30,
        "max_rsi": 65,
        "min_liquidity_mn": 2.0,
        "stop_loss_multiplier": 1.5,
        "target_multiplier": 2.5,
        "preferred_signals": ["STRONG BUY", "BUY"],
    },
    "aggressive": {
        "min_rsi": 25,
        "max_rsi": 75,
        "min_liquidity_mn": 0.5,
        "stop_loss_multiplier": 2.0,
        "target_multiplier": 4.0,
        "preferred_signals": ["STRONG BUY", "BUY", "HOLD"],
    },
}


def scrape_current_data() -> pd.DataFrame:
    """Get current DSE trade data for all stocks."""
    logger.info("[1/5] Scraping current DSE trade data...")
    df = get_current_trade_data()
    if df is None or len(df) == 0:
        logger.error("No DSE data returned from bdshare")
        sys.exit(1)

    for col in ["ltp", "high", "low", "close", "ycp", "change", "trade", "value", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["real_change"] = df["ltp"] - df["ycp"]
    df["change_pct"] = ((df["real_change"] / df["ycp"]) * 100).round(2)

    active = df[df["volume"] > 0].copy()
    logger.info("  Total listed: %d, Actively traded: %d", len(df), len(active))
    return active


def fetch_history(symbol: str) -> Optional[pd.DataFrame]:
    """Fetch historical data for a symbol. Returns None on failure."""
    try:
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        hist = get_basic_historical_data(start=start, end=end, code=symbol)
        if hist is not None and len(hist) >= 5:
            for col in ["open", "high", "low", "close", "volume"]:
                if col in hist.columns:
                    hist[col] = pd.to_numeric(hist[col], errors="coerce")
            return hist
    except Exception:
        pass
    return None


def fetch_histories_parallel(symbols: list[str], max_workers: int = 5) -> dict[str, Optional[pd.DataFrame]]:
    """Fetch historical data for multiple symbols in parallel."""
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_symbol = {executor.submit(fetch_history, sym): sym for sym in symbols}
        for future in as_completed(future_to_symbol):
            sym = future_to_symbol[future]
            try:
                results[sym] = future.result()
            except Exception:
                results[sym] = None
    return results


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

    # Check last 3 bars for recent crossover
    crossover = "none"
    lookback = min(3, len(histogram) - 1)
    for i in range(1, lookback + 1):
        prev = float(histogram.iloc[-(i + 1)])
        curr = float(histogram.iloc[-i])
        if prev <= 0 and curr > 0:
            crossover = "bullish"
            break
        elif prev >= 0 and curr < 0:
            crossover = "bearish"
            break

    macd_above_signal = float(macd_line.iloc[-1]) > float(signal_line.iloc[-1])

    return {
        "macd": round(float(macd_line.iloc[-1]), 3),
        "signal": round(float(signal_line.iloc[-1]), 3),
        "histogram": round(curr_hist, 3),
        "crossover": crossover,
        "macd_above_signal": macd_above_signal,
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


def classify_stock(indicators: dict, risk_profile: Optional[dict] = None) -> dict:
    """
    Classify a stock based on all indicators.

    risk_profile: one of the RISK_PROFILES dict values. Defaults to 'moderate'.
    Returns signal, score, confidence, entry/stop/target levels per the given profile.
    """
    if risk_profile is None:
        risk_profile = RISK_PROFILES["moderate"]

    min_rsi = risk_profile["min_rsi"]
    max_rsi = risk_profile["max_rsi"]
    sl_mult = risk_profile["stop_loss_multiplier"]
    tgt_mult = risk_profile["target_multiplier"]

    score = 0
    reasons = []

    ltp = indicators["ltp"]
    ema_50 = indicators.get("ema_50")
    ema_200 = indicators.get("ema_200")
    ema_9 = indicators.get("ema_9")
    ema_21 = indicators.get("ema_21")

    # --- Trend (EMA alignment) ---
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

    # --- RSI (tier-parameterized) ---
    rsi = indicators.get("rsi") or 50
    healthy_low = min_rsi + 5
    healthy_high = max_rsi - 5
    if healthy_low <= rsi <= healthy_high:
        score += 1
        reasons.append(f"RSI {rsi} (healthy range for profile)")
    elif rsi > max_rsi:
        score -= 1
        reasons.append(f"RSI {rsi} (OVERBOUGHT for this profile)")
    elif rsi < min_rsi:
        score += 1
        reasons.append(f"RSI {rsi} (OVERSOLD — potential reversal)")

    # --- MACD ---
    macd = indicators.get("macd_data", {})
    if macd.get("crossover") == "bullish":
        score += 2
        reasons.append("MACD bullish crossover")
    elif macd.get("crossover") == "bearish":
        score -= 2
        reasons.append("MACD bearish crossover")
    else:
        hist_val = macd.get("histogram", 0)
        above = macd.get("macd_above_signal", False)
        if above and hist_val > 0:
            score += 1
            reasons.append("MACD above signal (bullish momentum)")
        elif not above and hist_val < 0:
            score -= 1
            reasons.append("MACD below signal (bearish momentum)")

    # --- Bollinger ---
    bb = indicators.get("bollinger", {})
    if bb.get("squeeze"):
        reasons.append("Bollinger squeeze (breakout imminent)")
    if bb.get("position") == "lower" and rsi < min_rsi + 5:
        score += 2
        reasons.append("At lower Bollinger + oversold (strong buy signal)")
    elif bb.get("position") == "upper" and rsi > max_rsi - 5:
        score -= 1
        reasons.append("At upper Bollinger + overbought")

    # --- Volume ---
    vol = indicators.get("volume_analysis", {})
    change_pct = indicators.get("change_pct", 0)
    vol_ratio = vol.get("ratio", 1)
    if vol_ratio > 1.5:
        if change_pct > 0:
            score += 1
            reasons.append(f"Volume spike {vol_ratio}x with price up (accumulation)")
        elif change_pct < -1:
            score -= 1
            reasons.append(f"Volume spike {vol_ratio}x with price down (distribution)")

    # --- Intraday momentum ---
    if change_pct >= 5:
        score += 2
        reasons.append(f"Strong momentum +{change_pct}% today")
    elif change_pct >= 2:
        score += 1
        reasons.append(f"Positive momentum +{change_pct}% today")
    elif change_pct <= -5:
        score -= 2
        reasons.append(f"Heavy selling {change_pct}% today")
    elif change_pct <= -3:
        score -= 1
        reasons.append(f"Negative momentum {change_pct}% today")

    # --- Close position in day's range ---
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

    # --- Liquidity check (tier-parameterized) ---
    value_mn = indicators.get("value_mn", 0)
    min_liq = risk_profile["min_liquidity_mn"]
    if value_mn < min_liq:
        reasons.append(f"LOW LIQUIDITY for profile (৳{value_mn:.1f}M < ৳{min_liq}M required)")
        score = max(score, 0) - 2

    # --- Classify ---
    if score >= 5:
        signal = "STRONG BUY"
    elif score >= 2:
        signal = "BUY"
    elif score >= 0:
        signal = "HOLD"
    elif score >= -2:
        signal = "SELL"
    else:
        signal = "STRONG SELL"

    confidence = min(10, max(1, abs(score) + 2))

    # --- ATR-based targets (tier-parameterized multipliers) ---
    atr = indicators.get("atr", 0)
    min_atr = ltp * 0.02
    effective_atr = max(atr, min_atr)

    entry = ltp
    if signal in ("STRONG BUY", "BUY", "HOLD"):
        stop_loss = round(entry - sl_mult * effective_atr, 2)
        target_1 = round(entry + tgt_mult * effective_atr, 2)
        target_2 = round(entry + (tgt_mult * 1.6) * effective_atr, 2)
    else:
        stop_loss = round(entry + sl_mult * effective_atr, 2)
        target_1 = round(entry - tgt_mult * effective_atr, 2)
        target_2 = round(entry - (tgt_mult * 1.6) * effective_atr, 2)

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


def classify_all_tiers(indicators: dict) -> dict:
    """Run classify_stock for all 3 risk tiers. Returns risk_annotations dict."""
    return {
        tier: classify_stock(indicators, profile)
        for tier, profile in RISK_PROFILES.items()
    }


def main():
    start = datetime.now()
    logger.info("=" * 70)
    logger.info("  STOCK PEAK AI BROKER AGENT — DATA PIPELINE")
    logger.info("  %s BDT", start.strftime("%Y-%m-%d %H:%M"))
    logger.info("=" * 70)

    # Step 1: Get current data
    df = scrape_current_data()

    # Step 2: Market breadth
    logger.info("[2/5] Market breadth analysis...")
    advancing = len(df[df["real_change"] > 0])
    declining = len(df[df["real_change"] < 0])
    unchanged = len(df[df["real_change"] == 0])
    total_value = df["value"].sum()

    mood = "bullish" if advancing > declining * 1.3 else ("bearish" if declining > advancing * 1.3 else "neutral")
    logger.info("  Advancing: %d | Declining: %d | Unchanged: %d", advancing, declining, unchanged)
    logger.info("  Total turnover: ৳%.0fM", total_value)
    logger.info("  Market Mood: %s", mood.upper())

    # Step 3: Compute indicators for top stocks by value
    logger.info("[3/5] Analyzing top liquid stocks...")
    skip_history = "--no-history" in sys.argv
    if skip_history:
        logger.info("  (Skipping historical data — using current-day signals only)")

    df_sorted = df.sort_values("value", ascending=False)
    top_stocks = df_sorted.head(50)

    # Fetch histories in parallel
    symbols = [row["symbol"] for _, row in top_stocks.iterrows()]
    if not skip_history:
        logger.info("  Fetching historical data for %d stocks in parallel...", len(symbols))
        histories = fetch_histories_parallel(symbols, max_workers=5)
    else:
        histories = {sym: None for sym in symbols}

    analyzed = []
    hist_success = 0
    for i, (_, row) in enumerate(top_stocks.iterrows()):
        symbol = row["symbol"]

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

        hist = histories.get(symbol)
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

        # Classify once per tier, store as risk_annotations
        indicators["risk_annotations"] = classify_all_tiers(indicators)

        # Also store the "moderate" classification at top level for backward compat
        moderate_cls = indicators["risk_annotations"]["moderate"]
        indicators.update(moderate_cls)

        analyzed.append(indicators)

    logger.info(
        "  Analyzed %d stocks (%d with full history, %d current-day only)",
        len(analyzed), hist_success, len(analyzed) - hist_success,
    )

    # Step 4: Sort and categorize (using moderate tier as default)
    logger.info("[4/5] Classification results (moderate tier):")

    strong_buys = [s for s in analyzed if s["signal"] == "STRONG BUY"]
    buys = [s for s in analyzed if s["signal"] == "BUY"]
    holds = [s for s in analyzed if s["signal"] == "HOLD"]
    sells = [s for s in analyzed if s["signal"] == "SELL"]
    strong_sells = [s for s in analyzed if s["signal"] == "STRONG SELL"]

    logger.info("  STRONG BUY:  %d", len(strong_buys))
    logger.info("  BUY:         %d", len(buys))
    logger.info("  HOLD:        %d", len(holds))
    logger.info("  SELL:        %d", len(sells))
    logger.info("  STRONG SELL: %d", len(strong_sells))

    # Step 5: Output
    logger.info("[5/5] Top recommendations (moderate tier):")

    for s in sorted(strong_buys, key=lambda x: x["score"], reverse=True)[:5]:
        logger.info(
            "  %s ৳%.2f  %+.1f%%  Score: %+d  Conf: %d/10  R:R %.2f",
            s["symbol"], s["ltp"], s["change_pct"], s["score"], s["confidence"], s["risk_reward"],
        )

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
    logger.info("=" * 70)
    logger.info("  Full report: %s", path)
    logger.info("  Completed in %.0fs", elapsed)
    logger.info("=" * 70)

    return report


if __name__ == "__main__":
    main()
