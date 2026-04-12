#!/usr/bin/env python3
"""
Stock Peak Skill Proposal Engine — drafts prompt changes for admin review.

Runs after feedback_compiler.py in the EOD job. Reads the latest feedback
report (structured stats), makes ONE Claude API call to draft a specific
prompt change, and writes a proposal row to the `skill_proposals` table.

NEVER writes to skill files. NEVER applies changes automatically.
Admin must approve via the review dashboard before any change takes effect.

Rate-limited: max 1 proposal per skill per 7 days.
"""

import json
import logging
import logging.handlers
import os
import sys
import time
from datetime import datetime, timedelta

import anthropic
import psycopg2
import psycopg2.extras


LOG_DIR = os.environ.get("STOCKPEAK_LOG_DIR", "/var/log/stockpeak")
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("skill_proposal_engine")
logger.setLevel(logging.INFO)
_fh = logging.handlers.RotatingFileHandler(
    f"{LOG_DIR}/pipeline.log", maxBytes=10 * 1024 * 1024, backupCount=5
)
_fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s — %(message)s"))
_ch = logging.StreamHandler()
_ch.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(_fh)
logger.addHandler(_ch)

DATABASE_URL = os.environ["DATABASE_URL"]
CLAUDE_API_KEY = os.environ["CLAUDE_API_KEY"]
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
MIN_SAMPLE_SIZE = int(os.environ.get("FEEDBACK_MIN_SAMPLE", "30"))
PROPOSAL_COOLDOWN_DAYS = int(os.environ.get("PROPOSAL_COOLDOWN_DAYS", "7"))

# The skill file that generates picks — the target of prompt proposals
PICKS_SKILL_NAME = "generate_picks_llm"


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def get_latest_feedback(cur) -> dict | None:
    """Get the most recent feedback report with enough data."""
    cur.execute("""
        SELECT * FROM feedback_reports
        WHERE total_resolved >= %s
        ORDER BY report_date DESC
        LIMIT 1
    """, (MIN_SAMPLE_SIZE,))
    return cur.fetchone()


def check_cooldown(cur, skill_name: str) -> bool:
    """Return True if a proposal was created for this skill within cooldown period."""
    cutoff = (datetime.now() - timedelta(days=PROPOSAL_COOLDOWN_DAYS)).strftime("%Y-%m-%d")
    cur.execute("""
        SELECT COUNT(*) AS cnt FROM skill_proposals
        WHERE skill_name = %s AND created_at >= %s
    """, (skill_name, cutoff))
    row = cur.fetchone()
    return row["cnt"] > 0


def get_current_prompt_section(skill_name: str) -> str:
    """Read the current prompt from generate_picks_llm.py's build_prompt()."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(script_dir, "generate_picks_llm.py")
    with open(path) as f:
        return f.read()


def build_proposal_prompt(feedback: dict, current_code: str) -> str:
    """Build the Claude prompt that drafts a skill change proposal."""
    stats = feedback.get("raw_stats")
    if isinstance(stats, str):
        stats = json.loads(stats)

    return f"""You are a meta-analyst for an AI stock picking system on the Dhaka Stock Exchange (DSE).
Your job: analyze the system's performance stats and propose ONE specific, scoped change
to the pick generation prompt that would improve accuracy.

CURRENT PERFORMANCE (structured stats, sanitized — no raw market data):
{json.dumps(stats, indent=2)}

The current pick generation code is in generate_picks_llm.py. Here is the build_prompt() function
and surrounding context:

```python
{current_code}
```

RULES:
1. Propose exactly ONE change. Not five. One.
2. The change must be to the PROMPT TEXT inside build_prompt(), not to Python logic.
3. Be specific: show the exact current text and the exact replacement.
4. Base your proposal on the stats above. Cite specific numbers.
5. If win rate is above 65% and no pattern has win rate below 30%, respond with
   {{"no_change": true, "reasoning": "..."}} — the system is performing well.
6. Focus on the WORST pattern first (lowest win rate with sample >= 5).
7. Do NOT suggest changes that would make the prompt reference specific stock tickers.
8. Do NOT add rules about specific dates, holidays, or events.
9. Keep DSE context: T+2 settlement, ±10% circuit breaker, no derivatives.

Return ONLY valid JSON:
{{
  "no_change": false,
  "proposal_type": "prompt_adjustment",
  "current_text": "the exact substring of the current prompt to replace",
  "proposed_text": "the replacement text",
  "reasoning": "2-3 sentences explaining why, citing specific stats",
  "evidence": "the worst pattern: condition X, N picks, Y% win rate"
}}"""


def call_claude(prompt: str) -> dict | None:
    """Single Claude call to draft a proposal."""
    client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
    try:
        resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON in response")
        return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Claude response parse failed: %s", e)
        return None
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        return None


def store_proposal(cur, skill_name: str, proposal: dict, sample_size: int) -> str | None:
    """Write proposal to skill_proposals table. Returns proposal ID."""
    cur.execute("""
        INSERT INTO skill_proposals (
            skill_name, proposal_type, evidence_summary,
            current_text, proposed_text, reasoning, sample_size
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        skill_name,
        proposal.get("proposal_type", "prompt_adjustment"),
        proposal.get("evidence", ""),
        proposal.get("current_text", ""),
        proposal.get("proposed_text", ""),
        proposal.get("reasoning", ""),
        sample_size,
    ))
    row = cur.fetchone()
    return str(row["id"]) if row else None


def main():
    logger.info("=== Skill Proposal Engine ===")

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Check cooldown
    if check_cooldown(cur, PICKS_SKILL_NAME):
        logger.info(
            "Proposal for '%s' already exists within %d-day cooldown. Skipping.",
            PICKS_SKILL_NAME, PROPOSAL_COOLDOWN_DAYS,
        )
        cur.close()
        conn.close()
        return

    # Get latest feedback
    feedback = get_latest_feedback(cur)
    if not feedback:
        logger.info("No feedback report with >= %d resolved picks. Skipping.", MIN_SAMPLE_SIZE)
        cur.close()
        conn.close()
        return

    sample_size = feedback["total_resolved"]
    logger.info(
        "Latest feedback: %s (%d picks, %.1f%% win rate)",
        feedback["report_date"], sample_size,
        float(feedback["win_rate"]) * 100 if feedback["win_rate"] else 0,
    )

    # Read current code
    current_code = get_current_prompt_section(PICKS_SKILL_NAME)

    # Build proposal prompt and call Claude
    prompt = build_proposal_prompt(feedback, current_code)
    result = call_claude(prompt)

    if not result:
        logger.error("Failed to get proposal from Claude")
        cur.close()
        conn.close()
        return

    # Check if Claude says no change needed
    if result.get("no_change"):
        logger.info("Claude says no change needed: %s", result.get("reasoning", ""))
        cur.close()
        conn.close()
        return

    # Validate proposal has required fields
    required = ("current_text", "proposed_text", "reasoning")
    if not all(result.get(k) for k in required):
        logger.warning("Proposal missing required fields: %s", result)
        cur.close()
        conn.close()
        return

    # Verify current_text actually exists in the code
    if result["current_text"] not in current_code:
        logger.warning(
            "Proposed current_text not found in generate_picks_llm.py — hallucinated match. Skipping."
        )
        cur.close()
        conn.close()
        return

    # Store proposal
    proposal_id = store_proposal(cur, PICKS_SKILL_NAME, result, sample_size)
    cur.close()
    conn.close()

    logger.info("Proposal stored: %s", proposal_id)
    logger.info("  Type: %s", result.get("proposal_type", "prompt_adjustment"))
    logger.info("  Reasoning: %s", result.get("reasoning", ""))
    logger.info("  Evidence: %s", result.get("evidence", ""))
    logger.info("  ⚠ Pending admin review at /admin/skill-proposals")


if __name__ == "__main__":
    main()
