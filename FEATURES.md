# Stock Peak — Feature State

**Last updated:** 2026-04-14

Stock Peak is an **AI stock broker/consultant** for the Dhaka Stock Exchange. This document tracks feature state. The daily operational tracker is in `TODO.md`. The domain vision is in `docs/` (see `docs/00-index.md`).

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
- Landing page (Bengali hero, sample picks, market mood, scorecard, pricing)
- Dashboard with today's picks + market mood + scorecard + notification bell
- Portfolio CRUD (add/remove holdings, summary cards)
- Track Record (historical picks with outcome tags)
- About / Privacy / Disclaimer (Bengali)
- Risk profiling questionnaire with 30-day re-assessment lock
- Risk profile badge in nav

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

---

## Not yet shipped

See `TODO.md` for organized capability-by-capability breakdown with critical path. The short version:

Organized around the 6 pricing tiers / milestones. Each tier is a discrete product launch.

### M1 — Entry tier ৳260/month (ship target: 3-5 weeks from 2026-04-15)

Product: 3 daily picks + portfolio CRUD + programmatic P&L + stock search/timeline + payment + paywall + onboarding. Positioned as "AI picks + portfolio tracker," not consultant.

- Pipeline correctness: #1 (first run), #32 (transaction wrap), #34 (schema migrations), #7 (Pydantic)
- Infrastructure cleanup: #2 (remove Claude Code CLI), #3 (rotate key), #4 (bake notifications into image), #12 (paid LLM tier)
- M1 features: #35 (stock search + timeline), #36 (portfolio P&L), #37 (payment integration — applications start NOW), #38 (paywall + trial), #39 (onboarding flow)
- Quality: #33 (critical tests ~30), #31 (observability dashboard), #11 (bell everywhere), #13 (admin audit log)

### M2 — Premium (post-M1 validation)
- Risk-tiered signals (same stock = BUY/HOLD/SELL per user risk tier): #24 (Risk Manager per-user with `pick_deliveries` + feature flag)

### M3 — Pro
- Portfolio intelligence surfaced in UI: #27 (drawdown escalation), #30 (DSEX monitoring)

### M4 — Analyst
- Deep analysis: #6 (Agent SDK + tools), #10 (specialist agents), #25 (fundamental data), #26 (macro feeds), #8 (study TradingAgents)

### M5 — Elite (the moat)
- Evolving system: #15-#20 skill decomposition + registry + attribution + lifecycle + retrieval + DSE skill pack, #22 (regime detection), #23 (proposal engine upgrade), #5 (feedback into prompts), #14 (admin review UI), #9 (LangGraph)

### M6 — Expert+ (deeper features, same AI-research-service framing)
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
