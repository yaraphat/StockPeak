#!/usr/bin/env python3
"""
Abstract base class for Stock Peak pick generators.

Shared logic lives here: feedback context loading, prompt building,
multi-agent orchestration, and the CLI run() entry point.

Concrete subclasses override only call_claude():
  SDKPicksGenerator        — uses anthropic Python SDK (generate_picks_llm.py)
  ClaudeCodePicksGenerator — uses `claude --bare` CLI (generate_picks_claude_code.py)
"""

import argparse
import json
import logging
import logging.handlers
import os
import sys
from abc import ABC, abstractmethod

import psycopg2
import psycopg2.extras


class PicksGeneratorBase(ABC):

    def __init__(self):
        self.model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
        self.database_url = os.environ.get("DATABASE_URL", "")
        self.multi_agent_enabled = os.environ.get("MULTI_AGENT", "0") == "1"
        self._ticker_performance: dict = {}

        log_dir = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
        os.makedirs(log_dir, exist_ok=True)

        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            fh = logging.handlers.RotatingFileHandler(
                f"{log_dir}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
            )
            fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
            ch = logging.StreamHandler(sys.stderr)
            ch.setFormatter(logging.Formatter("%(message)s"))
            self.logger.addHandler(fh)
            self.logger.addHandler(ch)

    # ── Shared: feedback context ──────────────────────────────────────────────

    def load_feedback_context(self) -> str | None:
        """Load latest feedback report from DB, formatted as prompt context.
        Returns None if no feedback available or DB not configured."""
        if not self.database_url:
            return None
        try:
            conn = psycopg2.connect(self.database_url)
            conn.autocommit = True
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT win_rate, avg_gain_pct, total_resolved,
                       confidence_calibration, indicator_patterns,
                       mood_performance, worst_patterns, ticker_performance
                FROM feedback_reports
                WHERE total_resolved >= 10
                ORDER BY report_date DESC
                LIMIT 1
            """)
            row = cur.fetchone()
            cur.close()
            conn.close()
            if not row:
                return None

            lines = [
                f"YOUR TRACK RECORD (based on {row['total_resolved']} resolved picks):",
                f"- Overall win rate: {float(row['win_rate'])*100:.1f}%",
                f"- Average gain: {float(row['avg_gain_pct']):+.2f}%",
            ]

            cal = row.get("confidence_calibration") or {}
            if isinstance(cal, str):
                cal = json.loads(cal)
            if cal:
                lines.append("- Confidence calibration:")
                for bucket, data in cal.items():
                    lines.append(f"  - Confidence {bucket}: {data['win_rate']*100:.0f}% win rate ({data['sample']} picks)")

            worst = row.get("worst_patterns") or []
            if isinstance(worst, str):
                worst = json.loads(worst)
            if worst:
                lines.append("- WARNING — your worst-performing patterns:")
                for wp in worst:
                    lines.append(f"  - {wp['condition']}: {wp['win_rate']*100:.0f}% win rate ({wp['sample']} picks)")

            mood = row.get("mood_performance") or {}
            if isinstance(mood, str):
                mood = json.loads(mood)
            if mood:
                lines.append("- Win rate by market mood:")
                for m, data in mood.items():
                    if data.get("picks", 0) >= 3:
                        lines.append(f"  - {m}: {data.get('win_rate', 0)*100:.0f}% ({data['picks']} picks)")

            tp = row.get("ticker_performance") or {}
            if isinstance(tp, str):
                tp = json.loads(tp)
            self._ticker_performance = tp

            return "\n".join(lines)

        except Exception as e:
            self.logger.warning("Failed to load feedback context: %s", e)
            return None

    # ── Shared: prompt builder ────────────────────────────────────────────────

    def build_prompt(self, candidates: list[dict], market_summary: dict) -> str:
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
            tp = self._ticker_performance.get(c["symbol"])
            if tp and tp.get("picks", 0) >= 2:
                base += (
                    f"\n  Track record: {tp['picks']} past picks, "
                    f"{tp['wins']}W/{tp['losses']}L, avg gain {tp['avg_gain']:+.1f}%"
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

        feedback_ctx = self.load_feedback_context()
        feedback_block = ""
        if feedback_ctx:
            feedback_block = f"""
{feedback_ctx}

Use your track record to calibrate your confidence scores. Avoid patterns that have
historically underperformed. If a candidate's indicators match a worst-performing
pattern, weigh that heavily against selecting it.
"""

        return f"""You are a professional stock analysis AI for the Dhaka Stock Exchange (DSE), Bangladesh.

Market context: {mood.upper()} day — {advancing} advancing, {declining} declining stocks.
{multi_agent_instruction}{feedback_block}
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

    # ── Abstract: LLM call — subclasses implement this ────────────────────────

    @abstractmethod
    def call_claude(self, prompt: str) -> dict | None:
        """Make the LLM call. Return parsed JSON dict with 'picks' key, or None on failure."""
        ...

    # ── Shared: orchestration ─────────────────────────────────────────────────

    def generate(self, envelope: dict) -> dict:
        """Full pipeline: candidates envelope → picks envelope."""
        candidates = envelope["candidates"]
        market_summary = envelope.get("market_summary", {})

        if self.multi_agent_enabled:
            self.logger.info("Multi-agent enabled — running bull/bear debate first")
            from multi_agent import analyze_candidates
            api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")
            candidates = analyze_candidates(candidates, api_key=api_key)

        prompt = self.build_prompt(candidates, market_summary)
        result = self.call_claude(prompt)

        if not result or not result.get("picks"):
            raise RuntimeError("LLM produced no picks")

        return {
            "date": envelope["date"],
            "valid_tickers": envelope["valid_tickers"],
            "risk_annotations_map": envelope["risk_annotations_map"],
            "market_mood": result.get("market_mood", "neutral"),
            "market_mood_reason": result.get("market_mood_reason", ""),
            "picks": result["picks"],
        }

    # ── Shared: CLI entry point ───────────────────────────────────────────────

    def run(self, in_path: str | None = None, out_path: str | None = None):
        """Read candidate envelope, generate picks, write output."""
        self.logger.info("=== %s (model=%s) ===", self.__class__.__name__, self.model)

        raw = open(in_path).read() if in_path else sys.stdin.read()
        envelope = json.loads(raw)

        out = self.generate(envelope)

        payload = json.dumps(out, default=str)
        if out_path:
            with open(out_path, "w") as f:
                f.write(payload)
            self.logger.info("Picks envelope written to %s", out_path)
        else:
            sys.stdout.write(payload)
            sys.stdout.flush()

    @classmethod
    def main(cls):
        parser = argparse.ArgumentParser()
        parser.add_argument("--in", dest="in_path")
        parser.add_argument("--out")
        args = parser.parse_args()
        instance = cls()
        try:
            instance.run(in_path=args.in_path, out_path=args.out)
        except RuntimeError as e:
            instance.logger.error("%s — exiting non-zero", e)
            sys.exit(3)
