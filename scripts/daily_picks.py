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


def run_stage(name: str, args: list[str]) -> int:
    logger.info("→ %s", " ".join(args))
    result = subprocess.run(args, capture_output=False)
    if result.returncode != 0:
        logger.error("Stage %s failed with exit code %d", name, result.returncode)
    return result.returncode


def main():
    logger.info("=== Stock Peak Daily Picks Pipeline ===")
    logger.info("Time: %s", datetime.now().isoformat())

    today = datetime.now().strftime("%Y-%m-%d")
    cand_path = f"{TMP_DIR}/stockpeak-candidates-{today}.json"
    picks_path = f"{TMP_DIR}/stockpeak-picks-{today}.json"

    # Stage 1: prepare candidates (no LLM)
    logger.info("[1/3] prepare_candidates.py")
    rc = run_stage("prepare", [
        sys.executable, f"{SCRIPTS_DIR}/prepare_candidates.py", "--out", cand_path
    ])
    if rc != 0:
        sys.exit(rc)

    # Stage 2: LLM pick generation (the ONLY LLM step)
    logger.info("[2/3] generate_picks_llm.py")
    rc = run_stage("generate", [
        sys.executable, f"{SCRIPTS_DIR}/generate_picks_llm.py", "--in", cand_path, "--out", picks_path
    ])
    if rc != 0:
        sys.exit(rc)

    # Stage 3: validate, store, deliver (no LLM)
    logger.info("[3/3] store_picks.py")
    rc = run_stage("store", [
        sys.executable, f"{SCRIPTS_DIR}/store_picks.py", "--in", picks_path
    ])
    if rc != 0:
        sys.exit(rc)

    logger.info("=== Pipeline complete ===")


if __name__ == "__main__":
    main()
