#!/usr/bin/env python3
"""
Stock Peak Multi-Agent Analysis — Phase 4
Bull/bear dialectical debate per stock, synthesized into a conviction score.

For each of the top N candidates (default 10):
  1. bull_researcher()  — argues FOR the trade
  2. bear_researcher()  — argues AGAINST
  3. synthesizer()      — weighs both, produces conviction 1-10

The enriched candidates (with bull_case, bear_case, conviction_score) are
returned to daily_picks.py for the final Claude pick selection.

Max API calls: 10 candidates × 3 calls = 30 per run.
"""

import json
import logging
import os
import time
from typing import Optional

import anthropic

logger = logging.getLogger("multi_agent")

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
MAX_CANDIDATES = int(os.environ.get("MULTI_AGENT_MAX_CANDIDATES", "10"))


def _call_claude(client: anthropic.Anthropic, prompt: str, max_tokens: int = 600) -> Optional[str]:
    """Single Claude API call with one retry on timeout."""
    for attempt in range(2):
        try:
            resp = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except anthropic.APITimeoutError:
            if attempt == 0:
                logger.warning("Claude timeout, retrying in 5s...")
                time.sleep(5)
        except anthropic.APIError as e:
            logger.error("Claude API error: %s", e)
            break
    return None


def _stock_context(stock: dict) -> str:
    """Format stock indicators into a compact context block for prompts."""
    rsi = stock.get("rsi", "N/A")
    macd = stock.get("macd_data", {})
    bb = stock.get("bollinger", {})
    vol = stock.get("volume_analysis", {})

    return (
        f"Ticker: {stock['symbol']}\n"
        f"LTP: ৳{stock['ltp']:.2f} | Change: {stock.get('change_pct', 0):+.1f}% today\n"
        f"RSI-14: {rsi} | MACD crossover: {macd.get('crossover', 'none')} | "
        f"MACD above signal: {macd.get('macd_above_signal', False)}\n"
        f"Bollinger: price at {bb.get('position', 'middle')} band | "
        f"Squeeze: {bb.get('squeeze', False)}\n"
        f"Volume ratio (20d avg): {vol.get('ratio', 1):.1f}x | Trend: {vol.get('trend', 'unknown')}\n"
        f"EMA9: {stock.get('ema_9', 'N/A')} | EMA21: {stock.get('ema_21', 'N/A')} | "
        f"EMA50: {stock.get('ema_50', 'N/A')} | EMA200: {stock.get('ema_200', 'N/A')}\n"
        f"ATR: {stock.get('atr', 0):.2f} | Turnover: ৳{stock.get('value_mn', 0):.1f}M\n"
        f"Broker score (moderate): {stock.get('score', 0):+d} | Signal: {stock.get('signal', 'HOLD')}"
    )


def bull_researcher(client: anthropic.Anthropic, stock: dict) -> Optional[str]:
    """Argue FOR the trade. Returns 2-3 sentence bull case."""
    ctx = _stock_context(stock)
    prompt = f"""You are a bull-case researcher for DSE (Dhaka Stock Exchange) stocks.
Your job: make the strongest possible argument FOR buying this stock TODAY.
Cite specific indicators. Be concrete — mention actual numbers.
Do NOT hedge or mention risks. Pure bull case only.

Stock data:
{ctx}

Write 2-3 sentences. No preamble, no "Bull case:", just the argument."""
    return _call_claude(client, prompt, max_tokens=300)


def bear_researcher(client: anthropic.Anthropic, stock: dict) -> Optional[str]:
    """Argue AGAINST the trade. Returns 2-3 sentence bear case."""
    ctx = _stock_context(stock)
    prompt = f"""You are a bear-case researcher for DSE (Dhaka Stock Exchange) stocks.
Your job: make the strongest possible argument AGAINST buying this stock TODAY.
Cite specific indicators. Be concrete — mention actual numbers.
Do NOT mention upsides. Pure bear case only.

Stock data:
{ctx}

Write 2-3 sentences. No preamble, no "Bear case:", just the argument."""
    return _call_claude(client, prompt, max_tokens=300)


def synthesizer(
    client: anthropic.Anthropic,
    stock: dict,
    bull_case: str,
    bear_case: str,
) -> Optional[dict]:
    """
    Weigh bull vs bear and produce a conviction score + final recommendation.
    Returns dict with conviction (1-10), verdict, and reasoning_en/reasoning_bn.
    """
    ctx = _stock_context(stock)
    prompt = f"""You are a senior stock analyst synthesizing two opposing research reports for DSE.

Stock data:
{ctx}

BULL CASE:
{bull_case}

BEAR CASE:
{bear_case}

Weigh both sides. Consider the DSE context: frontier market, T+2 settlement,
circuit breaker ±10%, no derivatives for hedging.

Return ONLY valid JSON:
{{
  "conviction": 7,
  "verdict": "BUY",
  "reasoning_en": "2 sentences explaining why bull or bear won and what the key risk is",
  "reasoning_bn": "same reasoning in Bengali (2 sentences)"
}}

conviction: 1-10 (1=strong sell, 5=neutral, 10=strong buy)
verdict: one of BUY, HOLD, SELL"""

    text = _call_claude(client, prompt, max_tokens=400)
    if not text:
        return None

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON in synthesizer response")
        result = json.loads(text[start:end])
        # Clamp conviction to valid range
        result["conviction"] = max(1, min(10, int(result.get("conviction", 5))))
        # Ensure verdict is valid
        if result.get("verdict") not in ("BUY", "HOLD", "SELL"):
            result["verdict"] = "HOLD"
        return result
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Synthesizer JSON parse failed for %s: %s", stock["symbol"], e)
        return None


def analyze_candidates(
    candidates: list[dict],
    api_key: str,
    max_candidates: int = MAX_CANDIDATES,
) -> list[dict]:
    """
    Run bull/bear/synthesize for the top N candidates.
    Returns candidates list with multi_agent fields added to each stock dict.
    Candidates that fail analysis are returned unchanged (pipeline continues).

    Added fields per candidate:
      bull_case: str
      bear_case: str
      conviction: int (1-10)
      ma_verdict: str (BUY/HOLD/SELL)
      ma_reasoning_en: str
      ma_reasoning_bn: str
    """
    client = anthropic.Anthropic(api_key=api_key)
    top = candidates[:max_candidates]
    rest = candidates[max_candidates:]

    logger.info(
        "Multi-agent analysis: %d candidates (max %d), %d skipped",
        len(top), max_candidates, len(rest),
    )

    enriched = []
    for i, stock in enumerate(top):
        symbol = stock["symbol"]
        logger.info("  [%d/%d] %s — bull/bear/synthesize...", i + 1, len(top), symbol)

        bull = bull_researcher(client, stock)
        if not bull:
            logger.warning("  Bull researcher failed for %s — skipping", symbol)
            enriched.append(stock)
            continue

        bear = bear_researcher(client, stock)
        if not bear:
            logger.warning("  Bear researcher failed for %s — skipping", symbol)
            enriched.append(stock)
            continue

        synthesis = synthesizer(client, stock, bull, bear)
        if not synthesis:
            logger.warning("  Synthesizer failed for %s — skipping", symbol)
            enriched.append(stock)
            continue

        stock = dict(stock)  # don't mutate original
        stock["bull_case"] = bull
        stock["bear_case"] = bear
        stock["conviction"] = synthesis["conviction"]
        stock["ma_verdict"] = synthesis["verdict"]
        stock["ma_reasoning_en"] = synthesis.get("reasoning_en", "")
        stock["ma_reasoning_bn"] = synthesis.get("reasoning_bn", "")

        logger.info(
            "  → conviction %d/10 | verdict: %s",
            stock["conviction"], stock["ma_verdict"],
        )
        enriched.append(stock)

    # Re-sort by conviction (desc) then original score
    enriched.sort(key=lambda x: (x.get("conviction", 5), x.get("score", 0)), reverse=True)

    return enriched + rest
