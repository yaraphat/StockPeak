#!/usr/bin/env python3
"""
Stock Peak LLM Pick Generator — Stage 2 of the daily picks pipeline.

This is the ONLY script in the pipeline that imports `anthropic`.
In Stage 2 (Paperclip + Claude Code), this whole file gets replaced
by a Claude Code agent reading the candidate envelope and writing the
picks envelope directly. Until then, this exists.

Input:  candidate envelope JSON on stdin (or --in path), produced by
        prepare_candidates.py.
Output: picks envelope JSON on stdout (or --out path), shaped as:
  {
    "date": "...",
    "valid_tickers": [...],
    "risk_annotations_map": {...},
    "market_mood": "...",
    "market_mood_reason": "...",
    "picks": [...]
  }
"""

import argparse
import json
import logging
import logging.handlers
import os
import sys
import time
from typing import Optional

import anthropic


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("generate_picks_llm")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_ch = logging.StreamHandler(sys.stderr)
_ch.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_fh)
logger.addHandler(_ch)

CLAUDE_API_KEY = os.environ["CLAUDE_API_KEY"]
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
MULTI_AGENT_ENABLED = os.environ.get("MULTI_AGENT", "0") == "1"

claude = anthropic.Anthropic(api_key=CLAUDE_API_KEY)


def build_prompt(candidates: list[dict], market_summary: dict) -> str:
    mood = market_summary.get("mood", "neutral")
    advancing = market_summary.get("advancing", 0)
    declining = market_summary.get("declining", 0)

    candidate_lines = []
    has_multi_agent = any(c.get("conviction") for c in candidates)

    for c in candidates:
        base = (
            f"- {c['symbol']}: LTP ৳{c['ltp']}, RSI {c.get('rsi', 'N/A')}, "
            f"Score {c.get('score', 0):+d}, Conf {c.get('confidence', 0)}/10, "
            f"Vol ratio {c.get('volume_analysis', {}).get('ratio', 1):.1f}x, "
            f"MACD {c.get('macd_data', {}).get('crossover', 'none')}, "
            f"Signal: {c.get('signal', 'HOLD')}, R:R {c.get('risk_reward', 0):.1f}"
        )
        if c.get("conviction"):
            base += (
                f"\n  Multi-agent conviction: {c['conviction']}/10 | Verdict: {c.get('ma_verdict', 'HOLD')}"
                f"\n  Bull: {c.get('bull_case', '')}"
                f"\n  Bear: {c.get('bear_case', '')}"
                f"\n  Synthesis: {c.get('ma_reasoning_en', '')}"
            )
        candidate_lines.append(base)

    candidates_text = "\n".join(candidate_lines)

    multi_agent_instruction = ""
    if has_multi_agent:
        multi_agent_instruction = (
            "\nEach candidate has been reviewed by a bull researcher and a bear researcher. "
            "Use their conviction scores (1-10) and synthesis as a strong signal — "
            "prefer stocks where the bull case clearly outweighs the bear case.\n"
        )

    return f"""You are a professional stock analysis AI for the Dhaka Stock Exchange (DSE), Bangladesh.

Market context: {mood.upper()} day — {advancing} advancing, {declining} declining stocks.
{multi_agent_instruction}
These candidates have passed technical screening. Select the best 3 stocks to recommend to retail investors today.

CANDIDATES (pre-screened by broker_agent.py):
{candidates_text}

For each of your 3 picks, provide:
1. ticker: the stock trading code (must match exactly from the list above)
2. company_name: company name in English
3. company_name_bn: company name in Bengali
4. buy_zone: recommended entry price (near LTP)
5. target: target price
6. stop_loss: stop loss price (must be BELOW buy_zone)
7. confidence: 1-10
8. reasoning_bn: 2-3 sentences in Bengali explaining WHY this stock today
9. reasoning_en: same reasoning in English

Also provide:
- market_mood: "bullish", "neutral", or "bearish"
- market_mood_reason: 1 sentence explanation

Return ONLY valid JSON:
{{
  "picks": [
    {{"ticker": "...", "company_name": "...", "company_name_bn": "...", "buy_zone": 0.0, "target": 0.0, "stop_loss": 0.0, "confidence": 7, "reasoning_bn": "...", "reasoning_en": "..."}}
  ],
  "market_mood": "...",
  "market_mood_reason": "..."
}}"""


def call_claude(prompt: str) -> Optional[dict]:
    last_error = None
    for attempt in range(3):
        if attempt > 0:
            logger.warning("Retrying Claude API call (attempt %d/3)...", attempt + 1)
            time.sleep(5 * attempt)
        try:
            resp = claude.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start == -1 or end == 0:
                raise ValueError(f"No JSON in response: {text[:200]!r}")
            result = json.loads(text[start:end])
            if "picks" not in result:
                raise ValueError("JSON missing 'picks' key")
            logger.info("Claude returned %d picks (attempt %d)", len(result["picks"]), attempt + 1)
            return result
        except (json.JSONDecodeError, ValueError, anthropic.APITimeoutError) as e:
            last_error = e
            logger.warning("Claude attempt %d failed: %s", attempt + 1, e)
        except anthropic.APIError as e:
            logger.error("Claude API error: %s", e)
            return None
    logger.error("All Claude attempts failed: %s", last_error)
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_path", help="Read candidate envelope from this file (default: stdin)")
    parser.add_argument("--out", help="Write picks envelope to this file (default: stdout)")
    args = parser.parse_args()

    logger.info("=== generate_picks_llm (model=%s) ===", CLAUDE_MODEL)

    raw = open(args.in_path).read() if args.in_path else sys.stdin.read()
    envelope = json.loads(raw)

    candidates = envelope["candidates"]
    market_summary = envelope.get("market_summary", {})

    if MULTI_AGENT_ENABLED:
        logger.info("Multi-agent enabled — running bull/bear debate first")
        from multi_agent import analyze_candidates
        candidates = analyze_candidates(candidates, api_key=CLAUDE_API_KEY)

    prompt = build_prompt(candidates, market_summary)
    result = call_claude(prompt)

    if result is None or not result.get("picks"):
        logger.error("LLM produced no picks — exiting non-zero")
        sys.exit(3)

    out = {
        "date": envelope["date"],
        "valid_tickers": envelope["valid_tickers"],
        "risk_annotations_map": envelope["risk_annotations_map"],
        "market_mood": result.get("market_mood", "neutral"),
        "market_mood_reason": result.get("market_mood_reason", ""),
        "picks": result["picks"],
    }

    payload = json.dumps(out, default=str)
    if args.out:
        with open(args.out, "w") as f:
            f.write(payload)
        logger.info("Picks envelope written to %s", args.out)
    else:
        sys.stdout.write(payload)
        sys.stdout.flush()


if __name__ == "__main__":
    main()
