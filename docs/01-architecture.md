# StockNow — System Architecture

## Platform Type

Responsive web application (desktop + mobile browsers). Not a native mobile app.

---

## High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│   Next.js 14 + React 18 + TradingView Lightweight Charts         │
│   SSE (price feed) · WebSocket (orders/alerts) · TanStack Query  │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS / WSS
┌─────────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY (Go / Fiber)                       │
│   WebSocket gateway · SSE broadcaster · Rate limiting (Redis)    │
│   Auth middleware (JWT RS256) · RBAC enforcement                  │
└──────┬──────────────────┬─────────────────┬──────────────────────┘
       │                  │                 │
┌──────▼───────┐  ┌───────▼──────┐  ┌──────▼──────────┐
│  REST API    │  │   ML API     │  │  Notification   │
│  (FastAPI)   │  │  (FastAPI    │  │  Service        │
│  Portfolio   │  │  + Celery)   │  │  Price alerts   │
│  Screener    │  │  XGBoost     │  │  Push / Email   │
│  Accounts    │  │  LSTM        │  └─────────────────┘
│  Disclosures │  │  BentoML     │
└──────┬───────┘  │  SHAP/LIME   │
       │          └───────┬──────┘
       │                  │
┌──────▼──────────────────▼───────────────────────────────────────┐
│                        DATA LAYER                                │
│  QuestDB        — raw tick data                                  │
│  TimescaleDB    — OHLCV bars (1m / 5m / 1D), user queries       │
│  PostgreSQL 16  — users, orders, portfolio, audit log (append)   │
│  Redis 7        — latest prices, sessions, Pub/Sub fan-out       │
│  S3 WORM        — 7-year compliance archival (Object Lock)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   MESSAGE BUS (Apache Kafka)                      │
│  tick.raw · price.normalized · ml.jobs · audit.events            │
│  alerts.triggered · model.drift                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  DSE DATA INGESTION                               │
│  Phase 1: DSE iMDS license (delayed, aggregate)                  │
│  Phase 2: TREC partner ITCH feed (real-time Level 1)             │
│  Dev only: bdshare scraper + quotes.txt polling                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend framework | Next.js 14 + React 18 | SSR for SEO (stock pages), RSC for performance |
| Charts | TradingView Lightweight Charts v4 | 45KB, open-source, purpose-built, real-time streaming |
| Server state | TanStack Query v5 | Cache invalidation, background refetch, stale-while-revalidate |
| UI state | Zustand | Lightweight, no boilerplate |
| Build tool | Vite (for non-Next pages) | Fast HMR |
| API gateway | Go (Fiber) | Best WebSocket concurrency; Zerodha uses Go for this exact layer |
| REST API | Python FastAPI (async) | Auto-docs, ML ecosystem compatibility, async support |
| ML serving | FastAPI + Celery + BentoML | Practical for small team, MLflow-integrated, scalable |
| Explainability | TreeSHAP (inline) + GradientExplainer (async) | Inline for tree models, async for LSTM |
| Message bus | Apache Kafka | Durable replay, multi-consumer, industry standard |
| Real-time fan-out | Redis Pub/Sub | <1ms latency for price broadcast to WebSocket gateway |
| Tick DB | QuestDB | 40x faster than TimescaleDB for tick-level queries |
| OHLCV + bars DB | TimescaleDB (PostgreSQL ext.) | SQL ecosystem, JOINs with company data |
| Transactional DB | PostgreSQL 16 | ACID, JSONB, proven in financial apps |
| Cache | Redis 7 | Latest prices, sessions, SHAP cache, rate limits |
| Compliance archival | S3 + Object Lock COMPLIANCE | 7-year WORM, tamper-proof, queryable via Athena |
| Pipeline orchestration | Prefect | Low overhead for small team, Python-native |
| Experiment tracking | MLflow | Model registry, artifact versioning |
| Data versioning | DVC | Dataset snapshots tracked alongside git |
| Drift monitoring | Evidently AI | PSI-based retraining trigger |
| Hosting (compute) | AWS ap-south-1 (Mumbai) | Nearest AWS region; PDPO-compliant with local mirror |
| Hosting (PII/local) | Pico Public Cloud / Felicity IDC | Bangladesh-sovereign cloud for PDPO data localization |

---

## Real-Time Protocol Decision

| Protocol | Used For | Why |
|----------|----------|-----|
| SSE (Server-Sent Events) | Live price feed, portfolio value updates, news alerts | Server-to-client only; simpler to scale; HTTP/2 multiplexing; auto-reconnect |
| WebSocket | Order placement, personalized alerts, AI result push | Bidirectional; needed when client sends subscriptions |
| REST/HTTP | Portfolio CRUD, account management, screener queries | Standard request-response; no persistent connection needed |

---

## Kafka + Redis Fan-Out Pattern

```
DSE iMDS feed
    → Kafka Producer (tick.raw)
        → Consumer A: QuestDB writer (tick storage)
        → Consumer B: OHLCV bar aggregator → TimescaleDB
        → Consumer C: Price normalizer → Redis PUBLISH price:{symbol}
            → WebSocket / SSE Gateway → Browser clients
        → Consumer D: Alert engine (compare against user alert thresholds)
        → Consumer E: ML feature pipeline trigger
```

Kafka provides durability and replay. Redis Pub/Sub provides the final sub-millisecond hop to connected clients.

---

## CQRS Pattern for Financial Data

```
Write side:  User places order → PostgreSQL (ACID source of truth)
             → Kafka event (order.placed)
             → Kafka consumer → update Redis read model

Read side:   Dashboard queries → Redis / TimescaleDB (pre-materialized views)
             Never query PostgreSQL directly for dashboard reads
```

This decouples write consistency from read performance. Dashboard queries never contend with transaction writes.

---

## Deployment Architecture

```
AWS ap-south-1 (Mumbai)                  Bangladesh (Local)
┌─────────────────────────┐              ┌──────────────────────┐
│  EKS / EC2              │              │  Pico Public Cloud   │
│  Next.js (SSR)          │◄────sync────►│  or Felicity IDC     │
│  Go Gateway             │              │                      │
│  FastAPI (REST + ML)    │              │  PII database mirror │
│  Kafka cluster          │              │  Consent management  │
│  QuestDB / TimescaleDB  │              │  (NID, mobile,       │
│  Redis cluster          │              │  bank account)       │
│  S3 WORM (audit)        │              │                      │
└─────────────────────────┘              └──────────────────────┘
         │
         ▼
  CloudFront + BDIX edge
  (static assets, <5ms Dhaka)
```

The local copy at Pico/Felicity satisfies PDPO 2025 data localization for Confidential Personal Data. All compute and non-PII processing runs in AWS Mumbai.

---

## Component Responsibilities

| Component | Owns | Does Not Own |
|-----------|------|-------------|
| Go Gateway | WebSocket/SSE connections, auth token verification, rate limiting | Business logic, DB writes |
| FastAPI REST | Portfolio CRUD, screener, account management, BSEC disclosures | ML inference |
| FastAPI ML | Prediction endpoints, Celery task dispatch, SHAP results | User data |
| Celery workers | Model inference, SHAP computation, batch training jobs | HTTP concerns |
| Kafka | Event durability, ordering, fan-out decoupling | Serving HTTP clients |
| Redis | Sub-ms price cache, session state, rate limit counters, SHAP cache | Durable storage |
| QuestDB | Raw tick storage, intraday queries | User-facing queries |
| TimescaleDB | OHLCV bars, company fundamentals, user queries | Tick-level data |
| PostgreSQL | Users, portfolios, orders, audit log | Time-series data |
| S3 WORM | 7-year compliance archival | Operational queries |
