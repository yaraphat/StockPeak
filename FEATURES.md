# Stock Peak — Feature Tracking

Last updated: 2026-04-08

## Completed

### Core Platform
- [x] Next.js 14 web app with App Router (standalone Docker build)
- [x] Design system: Fraunces serif + Plus Jakarta Sans + Noto Sans Bengali + Geist Mono
- [x] Responsive layout (mobile-first, tested at 375px)
- [x] Bengali-first UI with English support
- [x] DESIGN.md with full design system specification
- [x] CLAUDE.md project instructions

### Authentication
- [x] Email/password signup with bcrypt hashing
- [x] Email/password login with session management (NextAuth v4 + JWT)
- [x] Google OAuth provider (wired up, needs credentials to activate)
- [x] Auto-login after signup
- [x] Protected routes (dashboard, portfolio redirect to login)
- [x] Error states and loading states on auth forms

### Pages
- [x] Landing page — Bengali hero, sample picks, market mood, scorecard, pricing, CTA
- [x] Signup — working form, creates user in PostgreSQL, 7-day free trial
- [x] Login — working form, authenticates against DB, "forgot password" link
- [x] Dashboard — today's picks (from DB), market mood indicator, scorecard
- [x] Portfolio — full CRUD (add/remove stocks), summary cards (holdings, shares, invested)
- [x] Track Record — historical pick performance with outcome tags
- [x] About — product description and methodology (Bengali)
- [x] Disclaimer — investment risk disclaimer (Bengali, BSEC note)
- [x] Privacy — privacy policy (Bengali)

### Backend
- [x] PostgreSQL database on VM (port 6051, db: stockpeak)
- [x] Database schema: users, subscriptions, stock_data, picks, pick_outcomes, alerts_sent, portfolio_holdings, scorecard_view
- [x] API routes: /api/auth/signup, /api/auth/[...nextauth], /api/picks, /api/scorecard, /api/portfolio
- [x] Python daily picks pipeline script (scrape DSE -> technical screen -> Claude API -> validate -> store -> deliver)
- [x] GitHub Actions cron workflow (Sun-Thu 6:00 AM BDT)

### Infrastructure
- [x] Docker multi-stage build (deps -> build -> production)
- [x] GitHub Actions CI/CD: push to main -> build Docker image -> push to ghcr.io -> SSH deploy to VM
- [x] nginx reverse proxy (port 8080 -> 3000) on VM
- [x] No source code on VM (Docker images only)
- [x] Auto-deploy on every push to main
- [x] GitHub Container Registry (ghcr.io/yaraphat/stockpeak/app)

### Documentation
- [x] Design doc (office-hours output)
- [x] CEO plan with scope decisions
- [x] Architecture docs (01-architecture.md)
- [x] ML pipeline docs (02-ml-pipeline.md)
- [x] Realtime data docs (03-realtime-data.md)
- [x] Compliance docs (04-compliance.md)
- [x] Competitor analysis (stocklensbd_analysis_report.md)

---

## TODO

### P0 — Critical (blocks real usage)

- [ ] **Activate daily picks pipeline** — configure CLAUDE_API_KEY on VM, test DSE scraper (bdshare), run dark launch for 1-2 weeks before publishing to users
- [ ] **Payment integration (SSLCommerz)** — apply for merchant account, implement payment webhooks, gate Pro features behind subscription
- [ ] **bKash payment** — apply for bKash merchant API (4-8 week approval), add as payment option once approved
- [ ] **Google OAuth credentials** — create Google Cloud project, configure OAuth consent screen, set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET

### P1 — Important (competitive parity with StockLens BD)

- [ ] **AI stock search** — free instant analysis tool on homepage (user enters ticker, gets AI analysis). Key conversion funnel for StockLens BD.
- [ ] **Dark mode** — StockLens BD defaults to dark. Add theme toggle, CSS variables already have dark mode values in DESIGN.md.
- [ ] **Forgot password flow** — email-based password reset with token
- [ ] **Email verification** — send verification email on signup, require before accessing premium features
- [ ] **Technical analysis dashboard** — charts, indicators, real-time market insights for Pro users
- [ ] **Weekly market report** — automated Saturday email with weekly pick performance, sector analysis, market outlook
- [ ] **Pick performance scorecard (public)** — shareable OG image showing hit rate, avg gain. Trust moat.

### P2 — Nice to have (differentiators)

- [ ] **Market mood indicator** — already in design, needs daily pipeline to generate mood alongside picks
- [ ] **Exit alerts (intraday)** — poll DSE every 15 min during market hours, alert when pick hits target/stop-loss. Deferred until scraper reliability proven.
- [ ] **WhatsApp delivery** — apply for WhatsApp Business API, add as delivery channel alongside email + Telegram
- [ ] **Telegram bot** — set up @StockPeakBD channel + bot, implement /today, /history, /subscribe commands, account linking
- [ ] **Email delivery (Resend)** — configure sender domain, implement daily picks email template
- [ ] **Yearly pricing plan** — ৳2,499/year (save 16%), toggle on pricing page
- [ ] **User profile page** — edit name, phone, Telegram link, subscription management
- [ ] **Logout button in nav** — currently only via /api/auth/signout URL

### P3 — Future phases

- [ ] **Custom ML models** — replace/augment LLM picks with XGBoost/LightGBM trained on DSE data (Phase 2)
- [ ] **TreeSHAP explainability** — show feature contributions for each pick prediction
- [ ] **Real-time DSE data** — DSE iMDS license or TREC partner feed
- [ ] **Portfolio P&L tracking** — fetch current prices, show unrealized gains/losses per holding
- [ ] **Stock screener** — filter DSE stocks by technical/fundamental criteria
- [ ] **AI chatbot** — conversational stock analysis assistant
- [ ] **Mobile app (PWA)** — installable progressive web app with push notifications
- [ ] **BSEC registration** — complete Investment Adviser registration (6-12 months)
- [ ] **Referral program** — "invite a friend, get 1 month free"

---

## Architecture

```
GitHub (yaraphat/StockPeak)
    |
    | git push main
    v
GitHub Actions
    | Docker build + push
    v
ghcr.io/yaraphat/stockpeak/app:latest
    |
    | SSH deploy
    v
VM (67.211.221.153)
    |-- Docker container (port 3000)
    |-- nginx reverse proxy (port 8080 -> 3000)
    |-- PostgreSQL (port 6051, db: stockpeak)
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Auth | NextAuth v4 (credentials + Google OAuth) |
| Database | PostgreSQL 16 (direct, no ORM) |
| DB driver (Node) | postgres.js |
| DB driver (Python) | psycopg2 |
| AI | Claude API (picks pipeline) |
| Container | Docker (multi-stage, standalone) |
| CI/CD | GitHub Actions -> ghcr.io -> SSH deploy |
| Reverse proxy | nginx |
| Fonts | Fraunces, Plus Jakarta Sans, Noto Sans Bengali, Geist Mono |
