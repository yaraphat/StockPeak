# Stock Peak — System Architecture

**Last updated:** 2026-04-19

This document describes both the current architecture (what's deployed) and the target architecture (what the consultant workflow requires). The historical StockNow/iMDS/Kafka/Go-gateway design has been archived — it was never built and the consultant-first vision made it unnecessary.

---

## Current architecture — single-container reality

```
┌──────────────────────────────────────────────────────────────────────┐
│ Docker container: stockpeak                                          │
│ (supervisord as PID 1)                                               │
│                                                                      │
│  ┌──────────────────┐   ┌───────────────┐   ┌──────────────────────┐│
│  │  PostgreSQL 16   │   │  Next.js 14   │   │  Python notifier     ││
│  │  port 5432       │◄──┤  port 3000    │   │  APScheduler loop    ││
│  │                  │   │  (standalone) │   │                      ││
│  │  Volume: pgdata  │   │               │   │  Spawns pipeline     ││
│  └──────────────────┘   └───────┬───────┘   │  subprocesses on cron│││
│           ▲                     │           │  & admin triggers    ││
│           │                     │           └──────────┬───────────┘││
│           │                     │                      │            ││
│           └─────────────────────┼──────────────────────┘            ││
│                                 │                                   ││
│  ┌──────────────────────────────▼──────────────────────────────┐   ││
│  │  Shared DB: picks, pick_outcomes, users, portfolio_holdings,  │  ││
│  │  notifications, skill_proposals, feedback_reports,            │  ││
│  │  dse_daily_snapshots, dse_stocks, stock_data, alerts_log,     │  ││
│  │  subscriptions, tier_catalog (M2), per_stock_analysis (M2),   │  ││
│  │  pending_payments, portfolio_snapshots, market_state_log, ... │  ││
│  └───────────────────────────────────────────────────────────────┘  ││
│                                                                      │
│  /var/log/stockpeak (Volume: logs)                                   │
│    notifier.log, pipeline.log, failure-analysis/YYYY-MM-DD.md        │
└──────────────────────────────────────────────────────────────────────┘
         │                                          │
         │ HTTPS (port 3000)                        │ HTTPS
         ▼                                          ▼
   Browser clients                           OpenRouter API
   (Bengali/English UI,                     (primary LLM, OpenAI-compat)
   notification bell polling                 ↓
   every 30s, browser                       anthropic/claude-sonnet-4.6
   Notification API)                        google/gemma-4-31b-it:free (fallback)
```

### What runs where

| Process | Role | Started by |
|---|---|---|
| `supervisord` | PID 1, manages all child processes with priority ordering | Docker entrypoint |
| `postgres` | PostgreSQL 16 server, listens on 127.0.0.1:5432 | supervisord (priority 10) |
| `node /app/server.js` | Next.js standalone server, port 3000 | supervisord (priority 20, waits 5s for postgres) |
| `python3 notification_engine.py` | APScheduler loop, fires jobs on DSE schedule | supervisord (priority 30, waits 8s) |
| Pipeline scripts | `broker_agent.py`, `prepare_candidates.py`, `generate_picks_openrouter.py`, `store_picks.py`, `outcome_tracker.py`, etc. | On-demand subprocess, triggered by notifier cron or admin API |

### Persistent volumes

- `pgdata` → `/var/lib/postgresql/data` — survives container destruction; all user/pick/notification data
- `logs` → `/var/log/stockpeak` — pipeline logs, notifier logs, failure post-mortems

### Environment wiring

Entrypoint (`docker/entrypoint.sh`) handles:
- PostgreSQL cluster init + schema migration on first boot
- App DB user grants
- LLM key aliasing: `OPEN_ROUTER_KEY` ↔ `OPENROUTER_API_KEY`, `CLAUDE_API_KEY` ↔ `ANTHROPIC_API_KEY`
- Auto-selection of `PICKS_BACKEND` based on which key is present
- Auto-generation of `NEXTAUTH_SECRET` if not pinned in `.env`
- Claude Code CLI wired to OpenRouter via `ANTHROPIC_BASE_URL` (to be removed per TODO #2)
- Writes `/run/stockpeak.env` that supervisord child programs `set -a; source`

---

## Shipped tier architecture

Two product tiers are live. Both share the infrastructure above; they differ in which API endpoints and UI panels are reachable.

### Entry tier (M1, ৳260/mo)

- Dashboard renders today's 3 picks from `picks` table
- Portfolio CRUD + P&L calculation
- Stock search + `/stocks/[ticker]` page with OHLCV chart
- Browser + in-app notifications
- Track record page

### Analyst tier (M2, ৳550/mo) — shipped 2026-04-15

```
User hits /stocks/[ticker] or /rankings
   │
   ▼
┌─ requireTier("analyst") in lib/access.ts ─┐
│  Queries v_user_access view                │
│  Returns 402 + upgrade_url if below tier   │
└────────────────┬───────────────────────────┘
                 │ passes
                 ▼
  /api/stocks/[t]/analysis       /api/rankings
   │                              │
   │  reads stock_data             │  reads dse_daily_snapshots +
   │  (≥50 rows required)          │  stock_data for all 396 tickers
   │                              │
   ▼                              ▼
  lib/indicators.ts               lib/indicators.ts
    rsi(), ema(), macd(),           classifySignal() per ticker
    atr(), volumeRatio(),           sorted + filterable
    swingLevels(),
    classifySignal()
   │
   ▼
  lib/trade-plan.ts
    generateTradePlan(price, atr, riskTier)
      entry zone: price ±0.5 ATR
      T2: price + (targetMult × ATR)
      T1: halfway to T2
      initialStop: price − (stopMult × ATR)
      ladder: 3 trailing steps at +1R/+2R/+3R
    computePositionSize(plan, portfolioValue, riskTier)
      1% risk rule × portfolio / R
   │
   ▼
  components/analysis-panel.tsx
    signal badge + AI-read bullets
    trade plan card (entry / targets / stop)
    visual stop-loss ladder
    position sizing (against user's actual portfolio)
    support/resistance levels
    52W range bar
    indicators grid
    red-flag alerts
```

**Key design choice:** the Analyst-tier analysis endpoint is **deterministic** — no LLM call per request. `classifySignal` uses the same scoring rules as the Python `broker_agent.py`, ported to TypeScript in `lib/indicators.ts`. This gives <1ms per-ticker latency and lets the rankings page score all 396 stocks on a single request. LLM-backed specialists are planned for M5 (see below).

**AI read bullets** are generated from indicator values by string templates, not an LLM — the name "AI read" is from the product surface, not the implementation.

**Per-stock cache:** `per_stock_analysis` table exists but is currently unused; endpoint computes on-demand. If request volume grows, a daily snapshot job can populate the cache and the endpoint will serve from it when fresh (<12h).

**Access gates applied across paid endpoints** (returns 402, not 401):

| Endpoint | Gate |
|---|---|
| `/api/picks` | `requireActiveAccess` |
| `/api/portfolio/pnl` | `requireActiveAccess` |
| `/api/notifications` | `requireActiveAccess` |
| `/api/scorecard` | `requireActiveAccess` |
| `/api/stocks/[t]/history` | `requireActiveAccess` (2yr) / public (30d) |
| `/api/stocks/[t]/analysis` | `requireTier("analyst")` |
| `/api/rankings` | `requireTier("analyst")` |
| `/api/portfolio` CRUD | `requireAuth` only (non-paid) |
| `/api/stocks/search`, `/api/stocks/[t]` | public (SEO funnel) |

---

## Target architecture — consultant workflow

The process topology stays the same (single container, supervisord). The pipeline stages evolve from a linear 3-stage subprocess chain into a multi-agent DAG.

### Pipeline stages (target)

```
DAILY CRON (10:00 BDT, Sun-Thu, skipped on DSE holidays)
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 1: DATA COLLECTION                                             │
│   broker_agent.py      → DSE scrape, technical indicators           │
│   fundamental_data     → P/E, ROE, D/E, EPS (task #25)              │
│   macro_feeds          → BSEC, remittance, BDT, FII/FPI (task #26)  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ → dse_daily_snapshots + fundamentals + macro
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 2: MULTI-AGENT ANALYSIS (parallel) — M5 specialist agent stack │
│   Technical Analyst    → indicators, patterns                       │
│   Fundamental Analyst  → quality gates, valuation                   │
│   Sentiment Analyst    → news, herding, block trades                │
│   Macro Analyst        → regime, BD-specific catalysts              │
│                                                                     │
│   Each uses Claude Agent SDK with tool access:                      │
│     get_price_history(ticker)                                       │
│     get_past_picks_for_ticker(ticker)                               │
│     compute_sector_exposure()                                       │
│     check_news_sentiment(ticker)                                    │
│     ... (task #6)                                                   │
│                                                                     │
│   TODAY (shipped Analyst tier): Stage 2 is the single deterministic │
│   classifySignal() in lib/indicators.ts. Specialists below replace  │
│   it in M5. The "Analyst" name refers to the shipped product tier;  │
│   specialists are the depth-capability layer added underneath.      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ → per-analyst reports
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 3: DIALECTICAL DEBATE                                          │
│   Bull Researcher    → synthesizes case FOR                         │
│   Bear Researcher    → synthesizes case AGAINST                     │
│   Synthesizer        → resolves, assigns confidence                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ → candidate picks with reasoning
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 4: RISK MANAGER — PER USER (task #24)                          │
│   For each user:                                                    │
│     Apply RISK_PROFILES (conservative/moderate/aggressive)          │
│     Check correlation vs existing holdings                          │
│     Enforce sector + position concentration limits                  │
│     Apply liquidity-aware sizing (DSE turnover tiers)               │
│     Run suitability check (FINRA 2111 equivalent — task #29)        │
│     Write recommendations_log row                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ → personalized pick list per user
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 5: DELIVERY                                                    │
│   store_picks.py → picks table + pick_outcomes('open')              │
│                  → notifications table (fanned out per user)        │
│                  → optional email (Resend)                          │
│                  → optional personal Telegram DM                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Skill library (task #15-20, cross-cutting)

Every LLM call in Stages 2-4 draws from a retrieved subset of the skill library.

```
skills/
├── technical/             # RSI/MACD/ATR/volume patterns
├── fundamental/           # quality gates, valuation
├── risk/                  # position sizing, correlation, drawdown
├── dse/                   # Z-category, circuit breakers, remittance, Eid
├── regime/                # bull/bear/sideways/high-vol variants
├── client/                # drawdown reassurance, FOMO guardrail, education
└── compliance/            # disclaimer phrasing, methodology disclosure

Each skill = YAML file with id, version, status, triggers, activates_for,
prompt_section, evidence (source doc + backtest stats), lineage.

Skill retrieval (task #19):
  For each pick candidate:
    → classify (sector, regime, risk tier, date)
    → query skills registry for skills whose activation rules match
    → compose dynamic system prompt from matched skills only

Skill attribution (task #17):
  When pick is generated: record `skill_activations(pick_id, skill_id, ...)`
  When pick resolves: update `skill_performance(skill_id, win_rate, avg_gain, ...)`
  Skill with poor attribution → auto-flag for deprecation review
```

### Feedback loop (exists, needs UI to close)

```
EOD (15:30 BDT)
  outcome_tracker.py      → resolves open picks
  failure_analysis.py     → daily Markdown post-mortems
  feedback_compiler.py    → feedback_reports table (structured stats only)
  skill_proposal_engine   → drafts proposals (task #23: per-skill instead of monolith)
         │
         ▼
  skill_proposals table (pending review)
         │
         ▼
  [HUMAN GATE]  /admin/skill-proposals UI (task #14)
    admin sees diff, evidence, sample size warnings
    approve → API writes YAML skill file + git commit + skill_performance reset
    reject  → logged with reason
    defer   → stays in queue

  Next pipeline run → loads updated skills → compounds improvement
```

### Intraday monitoring (exists, needs extension)

APScheduler inside notifier process, every 30 min 10:00-14:30 BDT:

| Job | What it checks | Current state |
|---|---|---|
| `intraday_monitor` | Stop-loss hits, approaching stops, target hits, ±5% moves on holdings | Built |
| `intraday_opportunity_scan` | STRONG BUY + vol ≥2× on stocks NOT in today's picks | Built |
| `drawdown_escalation` (#27) | Per-user portfolio drawdown -10/-15/-20/-30% tiers → escalating communication | Not built |
| `dsex_monitor` (#30) | DSEX index -2%/-5%, 5 consecutive red days, >80% advancing (herding) | Not built |

### Scheduled communication (partial)

| Frequency | Job | Current state |
|---|---|---|
| Daily 06:05 BDT | Pre-market brief | Built, content basic |
| Daily 15:30 BDT | EOD summary | Built |
| Thursday 16:00 BDT | Weekly digest | Built, content basic |
| Monthly 1st | Monthly report | Not built (#28) |
| Quarterly | Performance review | Not built (#28) |
| Annually | Risk profile reassessment | Not built (#28) |

---

## Tech stack (current)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind | SSR for SEO, App Router for server components, tight integration with NextAuth |
| Auth | NextAuth v4 + JWT | Rate-limited at `authorize()` callback, Google OAuth wired |
| DB | PostgreSQL 16 (no ORM) | ACID, JSONB for flexible schemas (risk_annotations, skill evidence), direct SQL keeps query logic visible |
| DB driver (Node) | postgres.js | Template-literal API, parameterized by default, no connection pool surprises |
| DB driver (Python) | psycopg2 | Mature, RealDictCursor for dict rows, `execute_batch` for bulk inserts |
| LLM (primary) | OpenRouter via `openai` Python SDK | Multi-provider access, unified billing, free tier for dev |
| LLM (target production) | Direct Anthropic API | Lower latency, no intermediary markup, target after #12 |
| Scheduler | APScheduler (Python) | Runs inside notifier process, persistent state via DB, market holiday aware |
| Process supervisor | supervisord | PID 1 inside container, priority-ordered startup, auto-restart |
| Container | Docker single image | One artifact, one deploy surface, survives destroy via volumes |
| Fonts | Fraunces, Plus Jakarta Sans, Noto Sans Bengali, Geist Mono | Per DESIGN.md — financial authority + Bengali support + tabular data |

## Tech stack additions (target)

| Added for | Library | Task |
|---|---|---|
| Agent runtime with tool use | `claude-agent-sdk` (Python) | #6 |
| Structured output validation | Pydantic / Pydantic AI | #7 |
| Pipeline orchestration | LangGraph | #9 |
| Skill library (YAML parsing + registry) | `pyyaml` + psycopg2 sync | #15, #16 |

---

## What was removed from the old architecture doc

The previous version described a multi-service cloud deployment (Go/Fiber gateway, FastAPI REST, FastAPI ML with Celery + BentoML, Apache Kafka, QuestDB, TimescaleDB, Redis 7, S3 WORM, EKS in AWS Mumbai + Pico mirror for PDPO). That architecture was never built — the consultant-first product vision made it unnecessary complexity. A single-container Docker deployment with PostgreSQL + Next.js + Python is sufficient for the current product and scales to thousands of users before any of those services become necessary.

The old architecture diagram has been preserved in `02-ml-pipeline.md` and `03-realtime-data.md` as historical reference. Those docs describe the XGBoost/LSTM-first vision that was superseded by LLM-based pipeline with per-skill attribution. They remain useful if custom ML models are added later as challengers to the LLM pipeline (TODO P3 / future).
