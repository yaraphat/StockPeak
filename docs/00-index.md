# Stock Peak — Documentation Index

Stock Peak is an **AI stock broker/consultant** for the Dhaka Stock Exchange, serving Bangladeshi retail investors. The product aims to replicate a professional broker's daily operational workflow — not a signal service.

---

## How to read these docs

**Start here:**
- [../TODO.md](../TODO.md) — Daily tracker. Current state + next actions + critical path.
- [../FEATURES.md](../FEATURES.md) — Feature state (shipped / not yet shipped).

**Product vision (read once, internalize):**
- [expert-analysis-methodology.md](./expert-analysis-methodology.md) — Professional stock analysis methodology: pre-market routine, indicators, risk management, DSE specifics, positive-expectancy framing. This defines *what a professional does*.
- [professional_broker_research.md](./professional_broker_research.md) — Deep research on how Stock Peak should operate as a professional AI broker: client profiling tiers, notification schedule, trade recommendation workflow, portfolio management rules, DSE constraints, regulatory obligations.
- [Expert Stock Broker Strategies and Client Management.md](./Expert%20Stock%20Broker%20Strategies%20and%20Client%20Management.md) — Strategic architecture of high-performance brokerage: temporal infrastructure, fiduciary standards, client retention through engagement, crisis communication during drawdowns.

**System design:**
- [01-architecture.md](./01-architecture.md) — Current + target system architecture (single-container reality + consultant workflow target).

**Historical/aspirational (preserved for reference, not current):**
- [02-ml-pipeline.md](./02-ml-pipeline.md) — Earlier ML-first vision (XGBoost/LSTM + BentoML). Superseded by LLM-based pipeline. Relevant if custom ML models are added as challengers (TODO P3).
- [03-realtime-data.md](./03-realtime-data.md) — DSE iMDS + TREC partner feed plans. Current: bdshare polling. Revisit if real-time feed becomes necessary.
- [04-compliance.md](./04-compliance.md) — PDPO 2025, BSEC, audit logging, 7-year retention, data localization. Aspirational architecture (multi-cloud). Current implementation: simpler single-region audit log. Revisit when BSEC Investment Adviser registration begins.

---

## Product vision in one paragraph

Stock Peak runs the daily operational workflow of a professional DSE broker: pre-market brief at 06:00, multi-agent analysis at market open (technical + fundamental + sentiment + macro), dialectical bull/bear debate before publishing, a per-user Risk Manager that enforces suitability + position sizing + correlation limits per client risk tier, intraday monitoring every 30 minutes for stops/targets/drawdown/market regime shifts, per-user EOD summary, weekly/monthly/quarterly/annual reports, and an autonomous feedback loop that proposes prompt improvements from outcome data (human-approved, git-versioned). The system is designed to compound — it gets measurably better every week by retiring skills that demonstrably fail and promoting skills that demonstrably work.

## What makes it different from a signal service

A signal service publishes picks and disappears. A consultant:
- Profiles each client (Conservative / Moderate / Aggressive) and surfaces the *same stock as different signals* per client
- Follows up after recommendations (target-hit education, stop-hit post-mortem)
- Reassures during drawdowns (escalating communication at -10% / -15% / -20% / -30% portfolio drawdown)
- Adds friction to panic selling (drawdown protocol + historical recovery context)
- Maintains a suitability record per recommendation (FINRA 2111 / Reg BI equivalent)
- Evolves expertise over time based on its own outcomes

## Current state (2026-04-14)

Infrastructure + authentication + notification backbone are built. Pipeline has not yet run end-to-end (first attempt blocked on OpenRouter quota exhausted + today being a DSE market holiday). Consultant capabilities roughly 30-40% delivered — see `../TODO.md` for capability-by-capability breakdown with critical path.

**Next unlock:** run pipeline end-to-end → decompose monolithic prompt into versioned skills with per-skill outcome attribution → add per-user Risk Manager stage.

## Biggest risks (updated for current reality)

| Risk | Severity | Mitigation |
|---|---|---|
| Pipeline has never run — scrapers/APIs/schema may have untested bugs | Critical | Task #1: run end-to-end on next trading day |
| One monolithic prompt — can't attribute wins/losses to specific skills | Critical | Tasks #15-17: skill decomposition + per-skill attribution |
| No per-user personalization — recommending aggressive picks to conservative users is both unethical and legally exposed | High | Task #24: Risk Manager per-user stage |
| No suitability audit log — can't defend against "you recommended a bad stock" complaints | High | Task #29: per-recommendation suitability log |
| LLM outputs malformed JSON — corrupts downstream stages silently | Medium | Task #7: Pydantic envelope validation |
| OpenRouter free tier too tight for production (50 req/day) | Medium | Task #12: move to direct Anthropic API (~$5-10/month) |
| BSEC Investment Adviser registration not started | Medium | Begin 6-12 month process once product is usable (after Capabilities 1-4) |
| No real-time DSE feed — bdshare is polling-based and may lag | Low | Accept for now; revisit if intraday monitoring accuracy becomes a complaint |
