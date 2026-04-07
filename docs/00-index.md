# StockNow — Technical Documentation Index

StockNow is an AI-driven, responsive web platform for the Dhaka Stock Exchange (DSE), targeting retail investors in Bangladesh.

## Documents

| Doc | Description |
|-----|-------------|
| [01-architecture.md](./01-architecture.md) | System architecture overview, tech stack, component diagram |
| [02-ml-pipeline.md](./02-ml-pipeline.md) | Full ML pipeline: features, training, inference, explainability, orchestration |
| [03-realtime-data.md](./03-realtime-data.md) | DSE data sources, licensing paths, scraper options, phased data strategy |
| [04-compliance.md](./04-compliance.md) | BSEC, PDPO 2025, audit logging, 7-year retention, data localization, security |

## Quick Reference: Biggest Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DSE data licensing | Critical | Contact DSE iMDS + TREC partner path |
| BSEC registration | Critical | Begin Investment Adviser registration now (6-12 months) |
| PDPO 2025 compliance | High | Consent management + PII localization at Felicity/Pico |
| ML data leakage | High | Walk-forward CV, embargo gap, scale-after-split |
| Real-time data at scale | Medium | Phase 1 iMDS delayed → Phase 2 TREC ITCH partnership |

## Phased Build Plan

```
Phase 1 — Foundation       DSE iMDS + Kafka pipeline + basic charts + auth
Phase 2 — Core Features    Portfolio tracker + screener + audit logging + BSEC disclosure
Phase 3 — AI Layer         XGBoost/LightGBM predictions + TreeSHAP + daily picks page
Phase 4 — Advanced AI      LSTM target price + Transformer + NLP chatbot
Phase 5 — VIP Tier         Premium gating + unlimited alerts + advanced TA
```
