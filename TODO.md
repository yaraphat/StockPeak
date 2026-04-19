# Stock Peak — Tracker

**Last updated:** 2026-04-19
**Current state:** M1 Entry tier and M2 Analyst tier both shipped. Pipeline ran end-to-end on 2026-04-15 (3 picks: SUNLIFEINS, COPPERTECH, PRAGATIINS) but hasn't run since — `dse_daily_snapshots` has 1 row dated 2026-04-15.
**Next unlock:** Kick the daily pipeline back on (broker_agent + daily_picks are wired and proven); clear M1 polish blockers in parallel.

---

## The product

Stock Peak launches as **tiered pricing**, sequencing product milestones against revenue validation. Each tier delivers a discrete capability band. The AI "consultant" framing is earned by shipping evolving intelligence — not claimed upfront before evidence.

**Pricing tiers:**

| Tier | Price | Capability | Milestone | Status |
|---|---|---|---|---|
| **Entry** | **৳260/mo** | 3 daily picks + portfolio CRUD + P&L + stock search/timeline | M1 | **Shipped** |
| **Analyst** | **৳550/mo** | DSE-wide rankings + per-stock AI analysis + trade plan + stop-loss ladder + position sizing | M2 | **Shipped** |
| — | — | Risk-tiered personalized signals (same stock = BUY/HOLD/SELL per tier) — capability added to Analyst | M3 | Not shipped |
| — | — | Portfolio intelligence UI: VaR, correlation warnings, drawdown escalation | M4 | Not shipped |
| — | — | Multi-specialist deep analysis (Fundamental + Sentiment + Macro agents per pick) | M5 | Not shipped |
| — | — | Evolving system — demonstrable improvement via per-skill attribution | M6 | Not shipped |
| — | — | Periodic reports + relationship features (still AI-research-service framing with disclaimer) | M7 | Not shipped |

Milestones M3+ add capability depth within the shipped Entry + Analyst tier structure. New paywalls are not planned; price changes on Analyst may follow value additions.

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

### Picks pipeline (ran end-to-end 2026-04-15)
- [x] 3-stage isolated pipeline: `broker_agent.py` → `prepare_candidates.py` → `generate_picks_openrouter.py` → `store_picks.py`
- [x] Technical indicators (RSI/MACD/ATR/Bollinger/volume) for all DSE actively-traded stocks
- [x] 3 risk tiers computed per stock (conservative/moderate/aggressive)
- [x] Multi-agent bull/bear debate (`multi_agent.py`, opt-in via `MULTI_AGENT=1`)
- [x] Risk profiling questionnaire with 30-day reassessment lock
- [x] OpenRouter backend + admin API routes for all pipeline stages
- [x] `daily_picks.py` auto-runs `broker_agent.py` if report is missing or >6h stale (Stage 0)
- [x] Dynamic market-state detection (`market_state.py`) replaces hardcoded DSE holiday list
- [x] First end-to-end run: 2026-04-15 10:46 BDT — 3 picks stored, 3 notifications fired

### M1 Entry tier — shipped 2026-04-15
- [x] **#35 Stock search + historical price timeline** (`/stocks/search`, `/stocks/[ticker]` with OHLCV chart, backfill script)
- [x] **#36 Portfolio P&L calculation + display**
- [x] **#37 Personal bKash + Nagad payment with SMS verification** (see memory/payment_architecture.md)
- [x] **#38 Paywall + trial expiry gating** (7-day trial → ৳260/mo, JWT session_version refresh on tier change)
- [x] **#39 Onboarding flow** — signup → `/welcome`

### M2 Analyst tier — shipped 2026-04-15
- [x] `schema-m2.sql` — `tier_catalog`, `subscriptions.tier`, `v_user_access` view with `current_tier` + `tier_rank`, `per_stock_analysis` cache table
- [x] Access control — `requireAuth()`, `requireActiveAccess()` (402 if expired), `requireTier("analyst")` (402 with upgrade_url)
- [x] 402 Payment Required enforced on all paid endpoints: `/api/picks`, `/api/portfolio/pnl`, `/api/notifications`, `/api/scorecard`, `/api/stocks/[t]/history` (2yr gate), `/api/stocks/[t]/analysis`, `/api/rankings`
- [x] `lib/indicators.ts` — server-side RSI(7/14), EMA(9/21/50/200), MACD(12,26,9), ATR(14), volume ratio, swing S/R, `classifySignal` (matches Python broker_agent rules)
- [x] `lib/trade-plan.ts` — ATR-based trade plan generator + 3-step trailing stop ladder + position sizing by risk tier
- [x] `/api/stocks/[ticker]/analysis` — full AI read + trade plan for any DSE ticker
- [x] `/api/rankings` — all 396 stocks scored, filterable + sortable
- [x] `/rankings` page — Analyst-gated sortable table
- [x] `components/analysis-panel.tsx` on `/stocks/[ticker]` — signal badge, AI read, trade plan card with entry zone / T1 / T2 / initial stop / stop-loss ladder / position sizing, support/resistance, 52W range bar, indicators grid, red flags; falls back to `AnalystUpsell` for Entry tier
- [x] Landing page gating — aggregate track record + locked teaser (no free sample picks)

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
- [x] ~~#1 Run pipeline end-to-end~~ — done 2026-04-15
- [ ] #32 Wrap `store_picks` insertion loop in DB transaction
- [ ] #34 Schema migration tracking in entrypoint (replaces marker-file deploy bomb)
- [ ] #7 Pydantic models for all LLM output envelopes

**Infrastructure cleanup:**
- [ ] #2 Remove Claude Code CLI from Dockerfile (saves 200MB, wrong tool)
- [ ] #3 Rotate exposed OpenRouter API key
- [ ] #4 Bake notification system into Docker image (currently live-patched)
- [ ] #12 Switch production LLM off free tier (direct Anthropic ~$5-10/mo, or paid OpenRouter 1000 req/day)

**M1 features:** all shipped — see "Completed" section above.

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

## M2 — Analyst tier ✅ SHIPPED 2026-04-15

See "Completed / M2 Analyst tier" section above for full list. Key ships: tier_catalog, access gates, `lib/indicators.ts`, `lib/trade-plan.ts`, `/api/stocks/[t]/analysis`, `/api/rankings`, `/rankings` page, `analysis-panel.tsx`, landing-page gating, 402 enforcement across paid endpoints.

---

## M3 — Per-user Risk Manager (capability added to Analyst)

**Product scope:** Same stock presented as BUY/HOLD/SELL per user's risk tier via per-user Risk Manager pipeline stage. The 3 risk tiers already exist in `risk_annotations` on broker-agent output; this milestone wires them into per-user delivery.

**Unlock trigger:** First 20 Analyst-tier paying users converted + demand for personalization.

- [ ] #24 Risk Manager per-user pipeline stage (includes `pick_deliveries` table + feature flag + suitability evidence JSONB)

---

## M4 — Portfolio intelligence in UI (capability added to Analyst)

**Product scope:** VaR display, correlation warnings, drawdown escalation notifications, DSEX-level market alerts.

**Unlock trigger:** M3 converts + demand signal for portfolio-risk features.

- [ ] #27 Portfolio drawdown tier escalation (-5/-10/-15/-20/-30% protocols)
- [ ] #30 DSEX index-level monitoring + market-wide alerts
- [ ] VaR + correlation surfaced in UI (portfolio_intelligence.py backend exists, needs frontend)

---

## M5 — Specialist agent stack (capability added to Analyst)

*Previously named "M4 Analyst — Deep analysis". Renamed because the Analyst tier name is now taken by the shipped product.*

**Product scope:** Multi-specialist agents exposed in pick analysis, fundamental data per pick, macro context per pick. Upgrades the deterministic `classifySignal` in `lib/indicators.ts` with Agent-SDK-backed specialists.

**Unlock trigger:** M4 converts + demand for "why did the AI pick this?"

- [ ] #6 Replace prompt-template LLM call with Claude Agent SDK + tool use
- [ ] #10 Expand specialist agent roles beyond bull/bear (fundamental, sentiment, macro, risk manager agents)
- [ ] #25 Wire fundamental data source — P/E, ROE, D/E, EPS growth for DSE stocks
- [ ] #26 Add macro data feeds — BSEC announcements, remittance, BDT rate, FII/FPI
- [ ] #8 Study TradingAgents reference project (arxiv.org/abs/2412.20138) before implementing

---

## M6 — Elite: Evolving system (the moat)

**Product scope:** Skill library with decomposed prompts, per-skill attribution, skill lifecycle management, admin proposal review UI, autonomous feedback loop closes weekly.

**Unlock trigger:** M5 converts + sufficient resolved-pick volume (~300+) for per-skill statistical significance.

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

## M7 — Expert+: Deeper features, same research-service framing

**Product scope:** Monthly/quarterly/annual performance reports with per-skill attribution. Client-relationship layer (drawdown reassurance, FOMO guardrails, education nudges). Generic pick-delivery ops log for support. ALL outputs still carry "AI research, not advice" disclaimer — no advisory positioning, no suitability language in copy.

**Unlock trigger:** M6 converts + demand for deeper features. No external regulatory gate.

- [ ] #29 Generic pick-delivery log (reframed from suitability audit — ops support, not compliance)
- [ ] #28 Monthly/quarterly/annual report generators
- [ ] #21 Client-relationship skills (drawdown reassurance, FOMO guardrails, target-hit follow-up, education nudges — all framed as "AI context," not "adviser guidance")

---

## Milestone → task map (complete)

| Task | Title | Milestone | Status |
|---|---|---|---|
| #1 | Run picks pipeline end-to-end | M1 | ✅ shipped 2026-04-15 |
| #2 | Remove Claude Code CLI from Dockerfile | M1 | pending |
| #3 | Rotate exposed OpenRouter API key | M1 | pending |
| #4 | Bake notification system into Docker image | M1 | pending |
| #7 | Pydantic envelopes | M1 | pending |
| #11 | Notification bell on all pages | M1 | pending |
| #12 | Switch production LLM off free tier | M1 | pending |
| #13 | Admin audit logging | M1 | pending |
| #31 | Observability dashboard | M1 | pending |
| #32 | Transaction wrap store_picks | M1 | pending |
| #33 | Critical test suite | M1 | pending |
| #34 | Schema migration tracking | M1 | pending |
| #35 | Stock search + timeline | M1 | ✅ shipped |
| #36 | Portfolio P&L | M1 | ✅ shipped |
| #37 | Payment integration | M1 | ✅ shipped |
| #38 | Paywall + trial gating | M1 | ✅ shipped |
| #39 | Onboarding flow | M1 | ✅ shipped |
| — | Rankings page + per-stock analysis + trade plan + ladder + access gates | M2 | ✅ shipped 2026-04-15 |
| #24 | Risk Manager per-user | M3 | pending |
| #27 | Drawdown tier escalation | M4 | pending |
| #30 | DSEX index monitoring | M4 | pending |
| #6 | Claude Agent SDK + tool use | M5 | pending |
| #8 | Study TradingAgents | M5 | pending |
| #10 | Specialist agents | M5 | pending |
| #25 | Fundamental data | M5 | pending |
| #26 | Macro feeds | M5 | pending |
| #5 | Feedback into prompts | M6 | pending |
| #9 | LangGraph orchestration | M6 | pending |
| #14 | Admin review UI | M6 | pending |
| #15 | Skill decomposition | M6 | pending |
| #16 | Skill registry | M6 | pending |
| #17 | Per-skill attribution (the moat) | M6 | pending |
| #18 | Skill lifecycle | M6 | pending |
| #19 | Skill retrieval | M6 | pending |
| #20 | DSE skill pack | M6 | pending |
| #22 | Regime detection | M6 | pending |
| #23 | Proposal engine upgrade | M6 | pending |
| #21 | Client-relationship skills | M7 | pending |
| #28 | Periodic reports | M7 | pending |
| #29 | Generic pick-delivery log (reframed) | M7 | pending |

**Remaining work: M1: 11 pending. M3: 1. M4: 2. M5: 5. M6: 11. M7: 3. Total: 33 pending. Shipped: 6 M1 + 1 M2 bundle = 7 milestone ships.**

---

## Operational state (as of 2026-04-19)

- **Container:** stockpeak running; postgres + nextjs + notifier all under supervisord. Healthcheck currently flags "unhealthy" (cosmetic: probes 127.0.0.1 but Next.js binds to container hostname; not a real outage).
- **Picks in DB:** 3 (SUNLIFEINS, COPPERTECH, PRAGATIINS — all dated 2026-04-15). `per_stock_analysis` cache empty (computed on-demand by endpoint).
- **Snapshots:** 1 row in `dse_daily_snapshots` dated 2026-04-15. Daily pipeline has not run since; needs to be kicked off for 2026-04-19.
- **Stock data coverage:** 187,136 rows across 396 tickers, through 2026-04-13.
- **Branch:** `claude-code-pipeline`
- **OpenRouter quota:** in use; no blocker

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
