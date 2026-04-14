#!/usr/bin/env python3
"""
Stock Peak Pick Generator — Claude Code CLI backend.

Overrides call_claude() from PicksGeneratorBase to use the `claude` CLI
instead of the Anthropic Python SDK. Everything else (feedback context,
prompt building, multi-agent debate, output shape) is inherited unchanged.

Uses `claude --bare --print` for non-interactive, API-key-only operation
inside the pipeline. No login, no keychain, no CLAUDE.md discovery.

Env vars:
  ANTHROPIC_API_KEY  — required (or CLAUDE_API_KEY, both accepted)
  CLAUDE_MODEL       — model to use (default: claude-sonnet-4-6)
  MULTI_AGENT        — set to "1" to enable bull/bear debate first
  DATABASE_URL       — optional, enables feedback context injection
"""

import json
import os
import subprocess
import sys
import time

from picks_generator_base import PicksGeneratorBase


class ClaudeCodePicksGenerator(PicksGeneratorBase):

    def __init__(self):
        super().__init__()
        # Accept either key name — entrypoint.sh bridges both
        self.api_key = (
            os.environ.get("ANTHROPIC_API_KEY")
            or os.environ.get("CLAUDE_API_KEY")
            or ""
        )
        if not self.api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY (or CLAUDE_API_KEY) must be set for Claude Code generator"
            )

    def call_claude(self, prompt: str) -> dict | None:
        """
        Invoke `claude --bare --print <prompt>` as a subprocess.
        Retries up to 3 times with exponential back-off on transient failures.
        """
        env = {**os.environ, "ANTHROPIC_API_KEY": self.api_key}
        last_error = None

        for attempt in range(3):
            if attempt > 0:
                self.logger.warning("Retrying claude CLI (attempt %d/3)...", attempt + 1)
                time.sleep(5 * attempt)

            try:
                result = subprocess.run(
                    [
                        "claude",
                        "--bare",
                        "--print", prompt,
                        "--model", self.model,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    env=env,
                )

                if result.returncode != 0:
                    raise RuntimeError(
                        f"claude exited {result.returncode}: {result.stderr[:400]}"
                    )

                text = result.stdout
                start = text.find("{")
                end = text.rfind("}") + 1
                if start == -1 or end == 0:
                    raise ValueError(f"No JSON in claude output: {text[:300]!r}")

                parsed = json.loads(text[start:end])
                if "picks" not in parsed:
                    raise ValueError("JSON missing 'picks' key")

                self.logger.info(
                    "claude CLI returned %d picks (attempt %d)",
                    len(parsed["picks"]), attempt + 1,
                )
                return parsed

            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                self.logger.warning("Attempt %d — parse error: %s", attempt + 1, e)
            except subprocess.TimeoutExpired:
                last_error = TimeoutError("claude CLI timed out after 120s")
                self.logger.warning("Attempt %d — timeout", attempt + 1)
            except RuntimeError as e:
                last_error = e
                self.logger.warning("Attempt %d — %s", attempt + 1, e)

        self.logger.error("All claude CLI attempts failed: %s", last_error)
        return None


if __name__ == "__main__":
    ClaudeCodePicksGenerator.main()
