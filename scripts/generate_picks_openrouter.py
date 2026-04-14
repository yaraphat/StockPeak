#!/usr/bin/env python3
"""
Stock Peak Pick Generator — OpenRouter backend.

Overrides call_claude() to use OpenRouter's OpenAI-compatible API instead of
the Anthropic SDK or Claude Code CLI. Everything else (feedback context, prompt
building, multi-agent debate, output shape) is inherited from PicksGeneratorBase.

Env vars:
  OPEN_ROUTER_KEY     — required (OpenRouter API key, sk-or-v1-...)
  OPENROUTER_MODEL    — model slug (default: anthropic/claude-3.5-sonnet)
                        Plain Claude IDs (e.g. claude-sonnet-4-6) are auto-prefixed
                        with "anthropic/" to form the OpenRouter model ID.
  DATABASE_URL        — optional, enables feedback context injection
  MULTI_AGENT         — set to "1" to enable bull/bear debate first
"""

import json
import os
import time

from openai import OpenAI

from picks_generator_base import PicksGeneratorBase


class OpenRouterPicksGenerator(PicksGeneratorBase):

    def __init__(self):
        super().__init__()
        self.api_key = (
            os.environ.get("OPEN_ROUTER_KEY")
            or os.environ.get("OPENROUTER_API_KEY")
            or ""
        )
        if not self.api_key:
            raise EnvironmentError(
                "OPEN_ROUTER_KEY (or OPENROUTER_API_KEY) must be set for OpenRouter generator"
            )

        # Model: prefer OPENROUTER_MODEL, then CLAUDE_MODEL, then default.
        # If the model ID has no "/" it's a plain Anthropic short name — prefix it.
        raw_model = (
            os.environ.get("OPENROUTER_MODEL")
            or os.environ.get("CLAUDE_MODEL", "anthropic/claude-sonnet-4.6")
        )
        self.or_model = raw_model if "/" in raw_model else f"anthropic/{raw_model}"

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
        )
        self.logger.info("OpenRouter backend ready — model: %s", self.or_model)

    def call_claude(self, prompt: str) -> dict | None:
        """
        Call OpenRouter with the picks prompt.
        Retries up to 3 times with exponential back-off on transient failures.
        """
        last_error = None

        for attempt in range(3):
            if attempt > 0:
                self.logger.warning("Retrying OpenRouter (attempt %d/3)...", attempt + 1)
                time.sleep(5 * attempt)

            try:
                response = self.client.chat.completions.create(
                    model=self.or_model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2048,
                    temperature=0.3,
                    timeout=120,
                )

                text = response.choices[0].message.content or ""
                start = text.find("{")
                end = text.rfind("}") + 1
                if start == -1 or end == 0:
                    raise ValueError(f"No JSON in OpenRouter response: {text[:300]!r}")

                parsed = json.loads(text[start:end])
                if "picks" not in parsed:
                    raise ValueError("JSON missing 'picks' key")

                self.logger.info(
                    "OpenRouter returned %d picks (attempt %d, model=%s)",
                    len(parsed["picks"]), attempt + 1, self.or_model,
                )
                return parsed

            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                self.logger.warning("Attempt %d — parse error: %s", attempt + 1, e)
            except Exception as e:
                last_error = e
                self.logger.warning("Attempt %d — API error: %s", attempt + 1, e)

        self.logger.error("All OpenRouter attempts failed: %s", last_error)
        return None


if __name__ == "__main__":
    OpenRouterPicksGenerator.main()
