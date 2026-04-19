# Stock Peak — Feature State

**Last updated:** 2026-04-19

Stock Peak is an **AI stock broker/consultant** for the Dhaka Stock Exchange. This document tracks feature state. The daily operational tracker is in `TODO.md`. The domain vision is in `docs/` (see `docs/00-index.md`).

**Live tiers:** Entry ৳260/mo (M1) + Analyst ৳550/mo (M2). Both shipped.

---

## Shipped

### User-facing product

**Authentication**
- Email/password signup + login (NextAuth v4 + JWT + bcrypt cost 12)
- Google OAuth wired (needs credentials activated)
- Email format validation, password complexity rules (letter + non-letter), rate limiting (10 attempts / 15 min per IP)
- Forgot password page (email delivery requires RESEND_API_KEY)
- 7-day free trial auto-provisioned on signup

**Dashboard + pages**
- Landing page (Bengali hero, aggregate track record, pricing, locked "today's picks" teaser — no free sample picks)
- Dashboard with today's picks + market mood + scorecard + notification bell
- Portfolio CRUD (add/remove holdings, summary cards)
- Track Record (historical picks with outcome tags)
- Stock detail page `/stocks/[ticker]` — OHLCV chart + (Analyst-tier) AI analysis panel
- **Rankings page `/rankings`** (Analyst tier) — sortable table of all 396 DSE stocks with signal / score / RSI / volume
- About / Privacy / Disclaimer (Bengali)
- Risk profiling questionnaire with 30-day re-assessment lock
- Risk profile badge in nav

**Tiers + pricing (shipped)**
- **Entry ৳260/mo** — 3 daily picks + portfolio P&L + stock search + charts + browser notifications + track record
- **Analyst ৳550/mo** — everything in Entry + full DSE rankings + per-stock AI analysis + trade plan with stop-loss ladder + position sizing by risk tier + event warnings
- 7-day free trial on signup (grants Entry-level access during trial)
- Tier definitions in `tier_catalog` table; `subscriptions.tier` FK; `v_user_access` view exposes `current_tier` + `tier_rank`

**M2 Analyst tier — per-stock AI analysis** (shipped 2026-04-15)
- `/api/stocks/[ticker]/analysis` — deterministic indicator endpoint (no LLM call), returns signal + score + trade plan + AI read + red flags
- `components/analysis-panel.tsx` — renders signal badge, AI-read bullets, trade plan card (entry zone, T1/T2 with %, initial stop), visual multi-step **stop-loss ladder** (Breakeven → Lock +0.5R → Lock +1.5R), position sizing against user's actual portfolio value, support/resistance, 52W range bar, indicators grid, red-flag alerts
- Gracefully degrades to `AnalystUpsell` card for Entry-tier users
- `lib/indicators.ts` — server-side RSI(7/14), EMA(9/21/50/200), MACD(12,26,9), ATR(14), volume ratio, swing S/R, `classifySignal` — matches Python `broker_agent.py` rules
- `lib/trade-plan.ts` — ATR-based trade plan generator, 3-step trailing stop ladder, position sizing by risk tier (conservative 0.5% / moderate 1% / aggressive 2% of portfolio)
- `per_stock_analysis` cache table (for future daily snapshots)

**M2 Analyst tier — DSE rankings** (shipped 2026-04-15)
- `/api/rankings` — all 396 stocks scored, filterable + sortable (Analyst-gated)
- Each row: ticker, signal, score, RSI, volume ratio, click-through to `/stocks/[ticker]`

**In-app notifications (replaces Telegram channel)**
- `notifications` DB table, per-user rows
- Notification bell with unread badge in dashboard nav (30-second polling)
- Browser Notification API integration (fires when new items arrive while tab is open)
- Full `/notifications` page grouped by day, paginated, with mark-read + mark-all-read
- 7 notification types wired: `daily_picks`, `pre_market_brief`, `intraday_opportunity`, `exceptional_opportunity`, `stop_loss_hit`, `target_hit`, `eod_summary`, `weekly_digest`

### Platform / infrastructure

**Design system**
- Fraunces (display) + Plus Jakarta Sans (body) + Noto Sans Bengali + Geist Mono (data)
- Restrained palette: `#0066CC` accent on warm neutrals
- Full spec in `DESIGN.md`

**Database (PostgreSQL 16)**
- Schemas: base (`users`, `picks`, `pick_outcomes`, etc.), portfolio, broker-agent, notifications
- Persistent Docker volume (`pgdata`), survives container destruction
- Row-level GRANTS to app user configured in entrypoint
- 4 schema migration files applied on first boot

**Single-container Docker deployment**
- PostgreSQL + Next.js + Python notifier + supervisord under one image
- Entrypoint auto-generates `NEXTAUTH_SECRET`, wires OpenRouter key, selects `PICKS_BACKEND`
- Health check on `/api/health`
- Log rotation via supervisord + Python rotating file handlers

### Backend machinery

**Picks pipeline** (3-stage, isolated)
- `broker_agent.py` — DSE scrape via bdshare, computes RSI/MACD/ATR/Bollinger/volume ratios for all actively-traded stocks, classifies per 3 risk tiers
- `prepare_candidates.py` — Stage 1: filters + prepares LLM input envelope
- `generate_picks_llm.py` / `generate_picks_openrouter.py` / `generate_picks_claude_code.py` — Stage 2: LLM pick generation (backend-selectable)
- `store_picks.py` — Stage 3: validates, stores in DB, fires notifications
- `daily_picks.py` — orchestrator with backend auto-selection
- `multi_agent.py` — opt-in bull/bear dialectical debate (`MULTI_AGENT=1`)

**Notification engine** (APScheduler in notifier process)
- 06:05 BDT pre-market brief + 06:30 retry
- Every 30min 10:00-14:30 BDT intraday monitoring (stops, targets, ±5% moves on holdings)
- Every 30min 10:05-14:35 BDT intraday opportunity scanner (STRONG BUY + volume spike ≥2×)
- 15:30 BDT EOD summary (triggers full feedback chain)
- Thu 16:00 BDT weekly digest
- 07:00 BDT pipeline watchdog (alerts owner if no picks by 7am)
- Market holiday awareness (DSE calendar 2026 hardcoded)

**Feedback loop** (autonomous daily, ONE human gate)
- `outcome_tracker.py` resolves open picks via OHLCV data
- `failure_analysis.py` writes daily Markdown post-mortems to `/var/log/stockpeak/failure-analysis/`
- `feedback_compiler.py` aggregates structured stats → `feedback_reports` table
- `skill_proposal_engine.py` drafts ≤1 proposal per skill per 7 days, sample size ≥30
- `skill_proposals` table with full safety rails (sanitization, write separation, git-commit on approval)

**Portfolio intelligence**
- `portfolio_intelligence.py` — historical VaR (95%, 252-day), correlation matrix, drawdown vs peak
- `portfolio_snapshots` DB cache (idempotent daily)

**Admin APIs** (all auth-gated + role=admin)
- `/api/admin/broker/snapshot` — latest DSE daily snapshot
- `/api/admin/broker/picks` — picks with outcomes
- `/api/admin/broker/logs` — pipeline log tail
- `/api/admin/broker/analyze` — run broker_agent.py
- `/api/admin/broker/pipeline` + `/prepare` + `/generate` + `/store` — pipeline stage triggers
- `/api/admin/skill-proposals` — proposal list + approve/reject (approval UI still pending — #14)

**Security hardening (2026-04-14)**
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy)
- Auth added to previously-public `/api/picks` and `/api/scorecard`
- Rate limiting on signup + login
- Email format + password complexity validation
- Date parameter validation on admin routes
- Python scripts use parameterized SQL throughout (no injection vectors)

**Access control + tier gating** (2026-04-15)
- `lib/access.ts` helpers: `requireAuth()`, `requireActiveAccess()` (402 if trial expired), `requireTier("analyst")` (402 with `upgrade_url` if below required tier)
- 402 Payment Required returned on access-gated endpoints (not 401) so frontend can route to `/subscribe`
- `bumpSessionVersion()` invalidates existing JWTs on tier change
- Paid endpoints now access-gated (not just auth-gated): `/api/picks`, `/api/portfolio/pnl`, `/api/notifications`, `/api/scorecard`, `/api/stocks/[t]/history` (2yr for paid, 30d otherwise), `/api/stocks/[t]/analysis`, `/api/rankings`
- Auth-only (non-paid): `/api/portfolio` CRUD, `/api/subscription`, `/api/auth/*`, `/api/payments/*`
- Public: `/api/stocks/search`, `/api/stocks/[t]` (for SEO funnel)

---

## Not yet shipped

See `TODO.md` for organized capability-by-capability breakdown with critical path. The short version.

**Shipped tiers:** M1 Entry (৳260/mo) and M2 Analyst (৳550/mo) are live. Remaining milestones add capability depth within the existing tier structure — not new paywalls.

### M1 Entry — remaining polish

- Pipeline correctness: #32 (transaction wrap), #34 (schema migrations), #7 (Pydantic)
- Infrastructure cleanup: #2 (remove Claude Code CLI), #3 (rotate key), #4 (bake notifications into image), #12 (paid LLM tier)
- Quality: #33 (critical tests ~30), #31 (observability dashboard), #11 (bell everywhere), #13 (admin audit log)

### M3 — Per-user Risk Manager (formerly "M2 Premium")
- Risk-tiered signals (same stock = BUY/HOLD/SELL per user risk tier): #24 (Risk Manager per-user stage with `pick_deliveries` + feature flag + suitability evidence JSONB)
- Note: today's 3 risk tiers are computed at the broker-agent layer and stored in `risk_annotations`, but not yet personalized per user at delivery time.

### M4 — Portfolio intelligence surfaced in UI (formerly "M3 Pro")
- #27 (drawdown escalation -5/-10/-15/-20/-30% protocols)
- #30 (DSEX index-level monitoring + market-wide alerts)
- Frontend for VaR + correlation + drawdown (backend already exists in `portfolio_intelligence.py`)

### M5 — Specialist agent stack (formerly "M4 Analyst")
*Renamed — the "Analyst" tier name now belongs to the shipped product. This milestone adds multi-specialist depth to Analyst.*
- Deep analysis: #6 (Agent SDK + tools), #10 (specialist agents — Fundamental / Sentiment / Macro), #25 (fundamental data), #26 (macro feeds), #8 (study TradingAgents)

### M6 — Elite (the moat)
- Evolving system: #15-#20 skill decomposition + registry + attribution + lifecycle + retrieval + DSE skill pack, #22 (regime detection), #23 (proposal engine upgrade), #5 (feedback into prompts), #14 (admin review UI), #9 (LangGraph)

### M7 — Expert+ (deeper features, same AI-research-service framing)
- Monthly/quarterly/annual reports, generic pick-delivery ops log, client-relationship layer: #28, #29 (reframed), #21
- **Regulatory note:** Stock Peak never registers as a BSEC Investment Adviser. AI research service with disclaimer — same legal category as StockLens BD, Bloomberg. See `.claude/projects/-*/memory/regulatory_positioning.md`.

### Competitive parity with StockLens BD (partial overlap with M1)
- AI stock search on homepage — covered by #35 (with historical chart; their version includes AI analysis which we skip for M1)
- Dark mode — deferred (CSS vars exist in DESIGN.md, ~1 day work when prioritized)
- Technical analysis dashboard with charts — partially covered by #35; deeper TA view deferred

### Future depth (post-M6)
- Custom ML models (XGBoost/LightGBM) as challenger to LLM picks
- Real-time DSE data via iMDS license or TREC partner feed
- PWA with push notifications (service worker + VAPID)
- WhatsApp Business API delivery channel

---

## Architecture snapshot

See `docs/01-architecture.md` for the full picture. Summary:

```
Single Docker container (supervisord as PID 1)
├── PostgreSQL 16 (volume: pgdata)
├── Next.js 14 standalone (port 3000)
└── Python notifier (APScheduler, on-demand subprocesses)
     └── Pipeline scripts spawned by admin API or cron: broker_agent → prepare → generate → store

LLM:
├── OpenRouter (primary, via Python openai SDK) — `generate_picks_openrouter.py`
├── Anthropic direct (fallback) — `generate_picks_llm.py`
└── Claude Code CLI (on deprecation list, task #2) — `generate_picks_claude_code.py`

Deployment: Docker compose on a single VM. GitHub Actions → ghcr.io → SSH deploy pipeline exists but currently working from the llm-pipeline branch directly.
```

Tech stack:

| Layer | Choice |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Auth | NextAuth v4 (credentials + Google OAuth) |
| Database | PostgreSQL 16 (direct, no ORM) |
| DB driver (Node) | postgres.js |
| DB driver (Python) | psycopg2 |
| LLM (picks) | OpenAI Python SDK → OpenRouter → Claude Sonnet 4.6 (default) |
| Container | Docker single image with supervisord |
| Process supervisor | supervisord (PostgreSQL + Next.js + notifier) |
| Scheduler | APScheduler (Python, inside notifier process) |
| Fonts | Fraunces, Plus Jakarta Sans, Noto Sans Bengali, Geist Mono |

---

## What was removed from the old FEATURES.md

The previous version (dated 2026-04-08) was a flat P0/P1/P2/P3 priority list. This rewrite reorganizes around **consultant capabilities** (run → per-user → depth → relationship → evolution) to match the product vision defined in the domain research docs. Nothing shipped was removed; unshipped items were reorganized and augmented with the 8-9 new tasks from the full-workflow audit (Risk Manager per-user stage, suitability logs, fundamental data, macro feeds, drawdown escalation, monthly/quarterly reports, DSEX monitoring, observability dashboard).

The 2026-04-19 revision adds the shipped Analyst tier (rankings + per-stock analysis + trade plan + stop-loss ladder + position sizing + access gates), reflects the pipeline first run on 2026-04-15, and renumbers future milestones M3-M7 since the "Analyst" name now belongs to the shipped tier.
