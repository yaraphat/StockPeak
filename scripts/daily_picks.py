#!/usr/bin/env python3
"""
Stock Peak Daily Picks Pipeline — thin orchestrator.

Pipes three stages together. Each stage is an isolated script with a single
responsibility, communicating via JSON envelopes:

  prepare_candidates.py     (no LLM — DB snapshot + candidate selection)
        ↓ JSON envelope
  generate_picks_llm.py     (LLM — the only file that imports anthropic)
        ↓ JSON envelope
  store_picks.py            (no LLM — validate, store, deliver)

In Stage 2 (Paperclip + Claude Code), generate_picks_llm.py gets replaced
by a Claude Code agent and the surrounding scripts stay unchanged.

Run individual stages directly for debugging:
  python3 scripts/prepare_candidates.py --out /tmp/cand.json
  python3 scripts/generate_picks_llm.py --in /tmp/cand.json --out /tmp/picks.json
  python3 scripts/store_picks.py --in /tmp/picks.json
"""

import logging
import logging.handlers
import os
import subprocess
import sys
from datetime import datetime


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("daily_picks")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_ch = logging.StreamHandler()
_ch.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_fh)
logger.addHandler(_ch)

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
TMP_DIR = os.environ.get("STOCKPEAK_TMP_DIR", "/tmp")

# Stage 2 backend: "openrouter" (default) | "claude-code" | "sdk" (legacy)
PICKS_BACKEND = os.environ.get("PICKS_BACKEND", "openrouter")
_STAGE2_SCRIPTS = {
    "openrouter":  "generate_picks_openrouter.py",
    "claude-code": "generate_picks_claude_code.py",
    "sdk":         "generate_picks_llm.py",
}


def run_stage(name: str, args: list[str]) -> int:
    logger.info("→ %s", " ".join(args))
    result = subprocess.run(args, capture_output=False)
    if result.returncode != 0:
        logger.error("Stage %s failed with exit code %d", name, result.returncode)
    return result.returncode


def main():
    logger.info("=== Stock Peak Daily Picks Pipeline ===")
    logger.info("Time: %s", datetime.now().isoformat())

    sys.path.insert(0, SCRIPTS_DIR)
    from market_state import MarketState, get_market_state, record_state
    state, details = get_market_state()
    logger.info("Market state: %s  %s", state, details)
    record_state(state, details)
    if state == MarketState.CLOSED_HOLIDAY:
        logger.info("Market closed (%s) — skipping pipeline.", details.get("reason"))
        return
    if state == MarketState.UNKNOWN:
        logger.warning("Market state UNKNOWN — proceeding anyway; broker_agent will surface data issues.")

    today = datetime.now().strftime("%Y-%m-%d")
    cand_path = f"{TMP_DIR}/stockpeak-candidates-{today}.json"
    picks_path = f"{TMP_DIR}/stockpeak-picks-{today}.json"
    broker_report = f"{TMP_DIR}/stockpeak-broker-report.json"

    # Stage 0: scrape + score DSE (broker_agent) if report is missing or >6h stale
    report_age_hr = 999
    if os.path.exists(broker_report):
        import time
        report_age_hr = (time.time() - os.path.getmtime(broker_report)) / 3600
    if report_age_hr > 6:
        logger.info("[0/4] broker_agent.py (report %s)",
                    "missing" if report_age_hr > 900 else f"{report_age_hr:.1f}h stale")
        rc = run_stage("broker_agent", [
            sys.executable, f"{SCRIPTS_DIR}/broker_agent.py"
        ])
        if rc != 0:
            logger.error("broker_agent failed — cannot proceed without fresh DSE data")
            sys.exit(rc)
    else:
        logger.info("[0/4] broker report fresh (%.1fh old) — skipping re-scrape", report_age_hr)

    # Stage 1: prepare candidates (no LLM)
    logger.info("[1/4] prepare_candidates.py")
    rc = run_stage("prepare", [
        sys.executable, f"{SCRIPTS_DIR}/prepare_candidates.py", "--out", cand_path
    ])
    if rc != 0:
        sys.exit(rc)

    # Stage 2: LLM pick generation — backend selected by PICKS_BACKEND env var
    stage2_script = _STAGE2_SCRIPTS.get(PICKS_BACKEND, _STAGE2_SCRIPTS["claude-code"])
    logger.info("[2/4] %s  (PICKS_BACKEND=%s)", stage2_script, PICKS_BACKEND)
    rc = run_stage("generate", [
        sys.executable, f"{SCRIPTS_DIR}/{stage2_script}", "--in", cand_path, "--out", picks_path
    ])
    if rc != 0:
        sys.exit(rc)

    # Stage 3: validate, store, deliver (no LLM)
    logger.info("[3/4] store_picks.py")
    rc = run_stage("store", [
        sys.executable, f"{SCRIPTS_DIR}/store_picks.py", "--in", picks_path
    ])
    if rc != 0:
        sys.exit(rc)

    logger.info("=== Pipeline complete ===")


if __name__ == "__main__":
    main()
