# Stock Peak — Tracker

**Last updated:** 2026-04-15
**Current state:** Infrastructure + auth + notification backbone built. Pipeline has never run end-to-end. Organized around **tiered milestone launches** with pricing, not a single-product ship.
**Next unlock:** Run pipeline end-to-end on next trading day (2026-04-19) while M1 commercial prep proceeds in parallel.

---

## The product

Stock Peak launches as **tiered pricing**, sequencing product milestones against revenue validation. Each tier delivers a discrete capability band. The AI "consultant" framing is earned by shipping evolving intelligence — not claimed upfront before evidence.

**Pricing tiers (planned):**

| Tier | Price | Capability | Milestone |
|---|---|---|---|
| **Entry** | **৳260/mo** | **3 daily picks + portfolio CRUD + P&L + stock search/timeline** | **M1** |
| Premium | TBD | Risk-tiered personalized signals (same stock = BUY/HOLD/SELL per tier) | M2 |
| Pro | TBD | Portfolio intelligence: VaR, correlation warnings, drawdown escalation | M3 |
| Analyst | TBD | Multi-specialist deep analysis (fundamental + macro + sentiment per pick) | M4 |
| Elite | TBD | Evolving system — demonstrable improvement over time via per-skill attribution | M5 |
| Expert+ | TBD | Deeper AI analysis + periodic reports + relationship features (still AI-research-service framing with disclaimer) | M6 |

**Positioning (all tiers):** Stock Peak is an **AI research/signal service**, never a registered investment adviser. Every output carries the Bengali disclaimer "শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়" (educational AI analysis, not investment advice). Same regulatory category as StockLens BD, Bloomberg, Morningstar — none BSEC-registered. AI agents cannot be BSEC-registered by law. M1 specifically: "AI picks + portfolio tracker" — matches StockLens BD's price tier but beats on portfolio-integrated P&L and stock-search timeline. Each subsequent tier adds capability depth within the research-service framing, never advisory claims.

---

## Domain research (read once, internalize)

- `docs/expert-analysis-methodology.md` (258 lines) — technical analysis, risk management, DSE specifics, positive-expectancy framing
- `docs/professional_broker_research.md` (412 lines) — client profiling, notification schedule, workflow phases, DSE rules
- `docs/Expert Stock Broker Strategies and Client Management.md` (227 lines) — temporal infrastructure, fiduciary, crisis communication

---

## Completed (baseline for M1)

### Core platform
- [x] Next.js 14 + App Router, standalone Docker build, Bengali-first UI
- [x] Design system (Fraunces + Plus Jakarta Sans + Noto Sans Bengali + Geist Mono)
- [x] All core pages: landing, signup, login, dashboard, portfolio CRUD, track-record, about, privacy, disclaimer, forgot-password

### Authentication & security (hardened 2026-04-14)
- [x] Email/password + Google OAuth scaffolding
- [x] bcrypt cost 12, email format + password complexity validation
- [x] Rate limiting on login/signup (10/15min per IP)
- [x] Auth required on `/api/picks` and `/api/scorecard`
- [x] Security headers (X-Frame-Options, HSTS, Referrer-Policy, etc.)
- [x] Date parameter validation on admin routes

### Picks pipeline (built, not yet run end-to-end)
- [x] 3-stage isolated pipeline: `broker_agent.py` → `prepare_candidates.py` → `generate_picks_openrouter.py` → `store_picks.py`
- [x] Technical indicators (RSI/MACD/ATR/Bollinger/volume) for all DSE actively-traded stocks
- [x] 3 risk tiers computed per stock (conservative/moderate/aggressive)
- [x] Multi-agent bull/bear debate (`multi_agent.py`, opt-in via `MULTI_AGENT=1`)
- [x] Risk profiling questionnaire with 30-day reassessment lock
- [x] OpenRouter backend + admin API routes for all pipeline stages

### Notifications (in-app, replacing Telegram channel)
- [x] `notifications` DB table + fan-out per user
- [x] `/api/notifications` GET/PATCH/read-all (auth-gated)
- [x] `/notifications` full-list page + dashboard NotificationBell (30s polling + browser Notification API)
- [x] 7 notification types: daily_picks, pre_market_brief, intraday_opportunity, exceptional_opportunity, stop_loss_hit, target_hit, eod_summary, weekly_digest
- [x] Intraday monitor (stops/targets/±5%) + intraday opportunity scan (volume spike ≥2×)

### Feedback loop (mechanism built, UI not)
- [x] outcome_tracker → failure_analysis → feedback_compiler → skill_proposal_engine
- [x] `skill_proposals` DB table with safety rails (write separation, sample-size floor, rate-limited)

### Portfolio intelligence (partial, no UI yet)
- [x] `portfolio_intelligence.py` — VaR (95%, 252-day), correlation matrix, drawdown vs peak
- [x] `portfolio_snapshots` cache table

### Docker + infrastructure
- [x] Single-container deployment (PostgreSQL + Next.js + notifier via supervisord)
- [x] Persistent volumes (pgdata, logs)
- [x] Entrypoint wiring (LLM keys, NEXTAUTH_SECRET auto-gen, backend selection)

---

## M1 — Entry tier (৳260/month) — ship target: 3-5 weeks

**Product scope:** 3 daily picks + portfolio CRUD + programmatic P&L + stock search/timeline + payment + paywall + onboarding.

**Positioning:** "AI picks + portfolio tracker." Research-service framing, not consultant, not adviser. Disclaimer on every pick. Same legal category as StockLens BD — no BSEC registration pursued or needed.

### Blockers (must ship before launch)

**Pipeline correctness:**
- [ ] #1 Run pipeline end-to-end once quota resets (unblocks everything)
- [ ] #32 Wrap `store_picks` insertion loop in DB transaction
- [ ] #34 Schema migration tracking in entrypoint (replaces marker-file deploy bomb)
- [ ] #7 Pydantic models for all LLM output envelopes

**Infrastructure cleanup:**
- [ ] #2 Remove Claude Code CLI from Dockerfile (saves 200MB, wrong tool)
- [ ] #3 Rotate exposed OpenRouter API key
- [ ] #4 Bake notification system into Docker image (currently live-patched)
- [ ] #12 Switch production LLM off free tier (direct Anthropic ~$5-10/mo, or paid OpenRouter 1000 req/day)

**M1 features:**
- [ ] **#35 Stock search + historical price timeline** (case-insensitive fuzzy search, OHLCV chart, backfill script)
- [ ] **#36 Portfolio P&L calculation + display** (programmatic, no AI)
- [ ] **#37 Personal bKash + Nagad payment with SMS verification** (no merchant approval, ~2-3 days)
- [ ] **#38 Paywall + trial expiry gating** (7-day trial → ৳260/mo subscription, JWT session_version refresh)
- [ ] **#39 Onboarding flow** (Day 0 → first pick retention mechanics, sample data during no-pick-yet window)

**Quality gates:**
- [ ] #33 Write critical test suite (~35 Tier-1 tests, blocks launch; ~27 Tier-2 post-launch)
- [ ] #31 Basic pipeline observability dashboard (need to see failures in <60s when first user complains)
- [ ] #41 Customer support tooling (FAQ + macros + shared support email, 50-user hard cap until scaled)

**Post-M1 (moved out per eng-review scope tightening 2026-04-15):**
- [ ] #11 Notification bell on all pages (dashboard-only works for M1)
- [ ] #13 Admin audit logging (no admin team yet)

**Parallel long-lead items (start this week):**
- [ ] Dedicated merchant phone setup for SMS verification (bKash + Nagad personal SIMs, SMS forwarder app configured to webhook). See memory/payment_architecture.md
- [ ] Capture real bKash + Nagad SMS samples (send yourself ৳10 from another account, screenshot the SMS) — needed to validate regex parser in #37
- [ ] One-time Bangladesh securities lawyer review of TOS + disclaimer language (single legal review, not registration; do before public signup opens)
- [ ] Pricing willingness-to-pay validation via 5 real user conversations (task #42)

**Dark launch requirement:** 2 weeks of successful pipeline runs before opening public signup so the track-record scorecard has substance for onboarding.

### M1 shipping order

```
Week 1 (2026-04-15 to 2026-04-21): FIX + FIRST RUN
  Mon-Tue: Set up merchant SMS verification phone (bKash + Nagad personal SIMs).
           Capture real bKash + Nagad SMS samples for regex tests (send yourself ৳10).
           Start #42 willingness-to-pay calls with 5 real users.
  Sun (2026-04-19): #1 pipeline first run (DRY_RUN=1) — DARK LAUNCH COUNTER STARTS
  Throughout: #32 TXN wrap + god-function split, #34 migrations, #2/#3/#4 cleanup,
              #12 switch to paid LLM tier (free 50/day cannot sustain dev + daily pipeline)

Week 2: M1 FEATURES (dark launch day 3-7)
  #35 stock search + timeline
  #36 portfolio P&L
  #7 Pydantic envelopes
  #37 bKash/Nagad SMS-verified payment flow

Week 3: QUALITY + COMMERCIAL (dark launch day 8-12)
  #33 Tier-1 tests (~35)
  #38 paywall middleware (JWT session_version pattern)
  #39 onboarding flow + sample-data screens
  #31 pipeline observability dashboard
  #41 customer support FAQ + macros

Week 4: BETA (dark launch day 13-17)
  Pre-launch gate verification (≥70% of last 20 picks within 1×ATR within 5 trading days)
  Lawyer review of TOS + disclaimer
  Friendly beta: 3 users sign up → send bKash → receive pick → mark read

Week 5: BUFFER for first-run bugs (dark launch day 18-22)
  Clean-run streak verification (14 consecutive trading days incident-free)
  If streak broken earlier: M1 launch slips into Week 6+

Week 6-7: PUBLIC LAUNCH
  Signup opens at ৳260/mo
  Hard cap at 50 users until support tooling + pipeline stability proven
```

**Timeline honesty:** Eng-review outside voice flagged 14 consecutive clean trading days likely pushes public launch to week 6-7, not 5. Week 5 is buffer for first-run debug iterations. No merchant approval wait anymore (personal bKash + Nagad ships in week 2), so timeline risk is pipeline stability + 14-day gate, not payment provider.

---

## M2 — Premium: Risk-tiered signals

**Product scope:** Same stock presented as BUY/HOLD/SELL per user's risk tier via per-user Risk Manager pipeline stage.

**Unlock trigger:** M1 shipped + first 20 paying users converted.

- [ ] #24 Risk Manager per-user pipeline stage (includes `pick_deliveries` table + feature flag + suitability evidence JSONB)

---

## M3 — Pro: Portfolio intelligence

**Product scope:** VaR display, correlation warnings, drawdown escalation notifications, DSEX-level market alerts.

**Unlock trigger:** M2 converts + demand signal for portfolio-risk features.

- [ ] #27 Portfolio drawdown tier escalation (-5/-10/-15/-20/-30% protocols)
- [ ] #30 DSEX index-level monitoring + market-wide alerts
- [ ] VaR + correlation surfaced in UI (portfolio_intelligence.py backend exists, needs frontend)

---

## M4 — Analyst: Deep analysis

**Product scope:** Multi-specialist agents exposed in pick analysis, fundamental data per pick, macro context per pick.

**Unlock trigger:** M3 converts + demand for "why did the AI pick this?"

- [ ] #6 Replace prompt-template LLM call with Claude Agent SDK + tool use
- [ ] #10 Expand specialist agent roles beyond bull/bear (fundamental, sentiment, macro, risk manager agents)
- [ ] #25 Wire fundamental data source — P/E, ROE, D/E, EPS growth for DSE stocks
- [ ] #26 Add macro data feeds — BSEC announcements, remittance, BDT rate, FII/FPI
- [ ] #8 Study TradingAgents reference project (arxiv.org/abs/2412.20138) before implementing

---

## M5 — Elite: Evolving system (the moat)

**Product scope:** Skill library with decomposed prompts, per-skill attribution, skill lifecycle management, admin proposal review UI, autonomous feedback loop closes weekly.

**Unlock trigger:** M4 converts + sufficient resolved-pick volume (~300+) for per-skill statistical significance.

- [ ] #15 Design skill decomposition — break monolithic prompt into named skill units
- [ ] #16 Build skill registry (filesystem YAML + DB sync)
- [ ] #17 Per-skill outcome attribution (the key unlock — makes the system learnable)
- [ ] #19 Context-aware skill retrieval
- [ ] #18 Skill lifecycle management (draft → shadow → active → deprecated)
- [ ] #20 DSE-specific skill pack (Z-category, circuit breakers, remittance months, Eid, BDT sensitivity)
- [ ] #22 Regime detection + per-regime skill variants
- [ ] #23 Upgrade skill_proposal_engine to target individual skills (not monolith)
- [ ] #5 Close broker context gaps (feed outcomes back into prompts)
- [ ] #14 Admin UI for skill proposal review (closes feedback loop)
- [ ] #9 Migrate orchestration from bash subprocess to LangGraph

---

## M6 — Expert+: Deeper features, same research-service framing

**Product scope:** Monthly/quarterly/annual performance reports with per-skill attribution. Client-relationship layer (drawdown reassurance, FOMO guardrails, education nudges). Generic pick-delivery ops log for support. ALL outputs still carry "AI research, not advice" disclaimer — no advisory positioning, no suitability language in copy.

**Unlock trigger:** M5 converts + demand for deeper features. No external regulatory gate.

- [ ] #29 Generic pick-delivery log (reframed from suitability audit — ops support, not compliance)
- [ ] #28 Monthly/quarterly/annual report generators
- [ ] #21 Client-relationship skills (drawdown reassurance, FOMO guardrails, target-hit follow-up, education nudges — all framed as "AI context," not "adviser guidance")

---

## Milestone → task map (complete)

| Task | Title | Milestone |
|---|---|---|
| #1 | Run picks pipeline end-to-end | M1 |
| #2 | Remove Claude Code CLI from Dockerfile | M1 |
| #3 | Rotate exposed OpenRouter API key | M1 |
| #4 | Bake notification system into Docker image | M1 |
| #7 | Pydantic envelopes | M1 |
| #11 | Notification bell on all pages | M1 |
| #12 | Switch production LLM off free tier | M1 |
| #13 | Admin audit logging | M1 |
| #31 | Observability dashboard | M1 |
| #32 | Transaction wrap store_picks | M1 |
| #33 | Critical test suite | M1 |
| #34 | Schema migration tracking | M1 |
| #35 | **Stock search + timeline** | **M1** |
| #36 | **Portfolio P&L** | **M1** |
| #37 | **Payment integration** | **M1 (long-lead)** |
| #38 | **Paywall + trial gating** | **M1** |
| #39 | **Onboarding flow** | **M1** |
| #24 | Risk Manager per-user | M2 |
| #27 | Drawdown tier escalation | M3 |
| #30 | DSEX index monitoring | M3 |
| #6 | Claude Agent SDK + tool use | M4 |
| #8 | Study TradingAgents | M4 |
| #10 | Specialist agents | M4 |
| #25 | Fundamental data | M4 |
| #26 | Macro feeds | M4 |
| #5 | Feedback into prompts | M5 |
| #9 | LangGraph orchestration | M5 |
| #14 | Admin review UI | M5 |
| #15 | Skill decomposition | M5 |
| #16 | Skill registry | M5 |
| #17 | Per-skill attribution (the moat) | M5 |
| #18 | Skill lifecycle | M5 |
| #19 | Skill retrieval | M5 |
| #20 | DSE skill pack | M5 |
| #22 | Regime detection | M5 |
| #23 | Proposal engine upgrade | M5 |
| #21 | Client-relationship skills | M6 |
| #28 | Periodic reports | M6 |
| #29 | Generic pick-delivery log (reframed) | M6 |

**M1: 17 tasks. M2: 1. M3: 2. M4: 5. M5: 11. M6: 3. Total: 39 (3 new added today + 1 net new + existing 34 - 0 deleted = 39).**

---

## Operational state (as of 2026-04-15)

- **Container:** stockpeak running; postgres + nextjs + notifier all healthy
- **Picks in DB:** 0 (pipeline never run)
- **Branch:** `claude-code-pipeline` (4373+ / 657− vs main, 10+ uncommitted files)
- **Today:** DSE closed (Bengali New Year day 2, Pohela Boishakh). Tomorrow also closed. First run opportunity: Sunday 2026-04-19.
- **OpenRouter quota:** expected to reset at midnight UTC

---

## Outside voice note (2026-04-14 CEO review)

An independent review flagged 10 gaps. Milestone reframing resolved 8 of them; 2 remain open for operator attention:

- Dark launch requires 2 weeks of picks before public launch — must plan calendar around this
- ~~BSEC IA registration is a 6-12 month sequence~~ **Corrected 2026-04-15:** Stock Peak operates as AI research service; no BSEC IA registration pursued. See memory/regulatory_positioning.md. Single pre-launch lawyer review of TOS + disclaimer is the only legal spend.

## Key decisions from CEO review (2026-04-15)

1. **Ship model: tiered milestones, not single-product launch.** M1 ships entry tier; each higher tier unlocks on revenue validation.
2. **All-tier positioning:** AI research/signal service with disclaimer, never registered investment adviser. AI agents cannot be BSEC-registered by law. Same legal category as StockLens BD, Bloomberg.
3. **#24 Risk Manager scope decisions baked in:** `pick_deliveries` table + `per_user_pm_enabled` feature flag + transactional write of recommendations_log + suitability_evidence JSONB + per-user try/except isolation.
4. **#29 reframed entirely** — "suitability audit log" was imported US framing. Rewritten as generic pick-delivery ops log (no "suitability" vocabulary) because Stock Peak never claims adviser status. Ops-support purpose, not compliance.
5. **Test suite (#33) and transaction wrapping (#32) are M1 blockers** — ship before any paying user.
6. **Schema migrations (#34) must replace marker-file logic** — current entrypoint silently skips future schema changes on redeploy.
