# StockNow — Real-Time DSE Data Sources

## The Core Problem

DSE does not have a mature data vendor ecosystem. There is no self-service API, no published pricing, and no ISV program for non-brokers seeking real-time data. This is the most critical infrastructure risk for the project.

---

## Official DSE Data Products

### 1. DSE iMDS (Intelligent Market Data Server)

**What it actually is:** A delayed aggregate market data product — not a real-time feed.

- Delay: **10–20 seconds**, recalculated every 1 minute
- This is a coarse snapshot service, not tick-by-tick streaming

**Data provided:**

| Category | Fields |
|----------|--------|
| Market statistics (per instrument) | Open, High, Low, Close, Last Trade Price, Yesterday's Close, Trade count, Volume, Value |
| News/Announcements | Timestamp, instrument code, announcement text, expiry |
| Trade statistics (market-wide) | Total trades, total quantity, total value |
| Index data | DSEX, DS30, DSES — capital value, deviation from open (absolute and %) |

**What it does NOT provide:** Level 2 order book, bid/ask prices, tick data, real-time streaming.

**Connection protocol:** Not publicly documented. Technical spec is delivered only after signing an NDA with DSE-ICT.

**How to apply:**
- Email: `info@dse.com.bd`
- Phone: +88-02-41040189-200
- Address: DSE Tower, Plot #46, Road #21, Nikunja-2, Dhaka-1229
- No self-service portal; pricing is negotiated under a commercial agreement

**Verdict:** The only legally clean non-broker path to licensed DSE price data. Delayed, aggregate — sufficient for a retail investor product that shows near-real-time prices with a visible delay disclaimer.

---

### 2. DSE BHOMS API (FIX + ITCH)

**What it is:** Real-time order routing (FIX) and market data (ITCH) connectivity to the DSE X-Stream INET matching engine (Nasdaq-powered).

**Data provided:**
- True real-time Level 1 (and potentially Level 2) order book data via ITCH protocol
- Sub-second latency
- Order placement, modification, cancellation via FIX

**Who can access:** **TREC Holder Companies (licensed brokers) only.** Non-broker fintechs cannot apply directly.

**Current adoption (early 2026):**
- 72 TREC holders applied
- 47 received FIX certification
- 35 are live with their own OMS

**Critical restriction:** The BHOMS agreement explicitly states that TREC holders cannot redistribute real-time ITCH data to third parties for commercial use without **DSE's written approval**.

**Path for non-brokers:** Partner with a willing TREC holder and jointly request DSE's written approval for data sharing. This is the only path to true real-time data for a non-broker.

---

### 3. DSE EOD Data Product

**What it provides:**
- Post-market trade statistics per instrument: Open, High, Low, Close, % Change, Trade count, Volume, Value
- Top 10 Gainers/Losers (two sets: Open vs LTP, Yesterday's Close vs Close)
- Block transaction data
- Categorized market summaries (A/B/N/Z groups, Mutual Funds, Bonds)

**Delivery:** Contact DSE for format and pricing.

**Verdict:** Sufficient for historical analysis, ML training data, and post-market summaries. Not suitable for real-time display.

---

### 4. DSE Data Archive (Free, Public)

- URL: `dsebd.org/data_archive.php`
- Covers: Market Summary Data, Day End Archive per instrument, News Archive
- Last **2 years** accessible via the web interface
- No API — manual web retrieval only
- Community archive for pre-2023 data: `dsestocks.com/dse-csv-data/` (1999–2023 CSV)
- `dsebd.org/datafile/quotes.txt` — **most stable machine-readable public endpoint**: plain-text file, two columns (instrument code + last trade price), updated periodically

---

### 5. DSE Mobile Service (GUI Only, Not Programmable)

- Cost: BDT 125/month per connection (VAT inclusive)
- Who: TREC holders register their clients via FlexTP OMS
- Data: Real-time bid/ask, order management
- Platform: Native iOS/Android + HTML5 web (DSE-Investor)
- **This is an investor GUI, not an API.** There is no programmatic data extraction.

---

## Third-Party Commercial Data

### ICE Data Services

**DSE coverage from ICE:** End-of-Day data only (confirmed from ICE Coverage List). Despite marketing language, there is no real-time DSE feed from ICE.

**Connection:** Proprietary ICE Consolidated Feed protocols. Not standard WebSocket or REST.

**Cost:**
- Direct Connect / Price Server License: **$2,400/month** per company ID
- FIX OS / Binary Gateway: $550/month per company ID
- Minimum realistic cost: ~$3,000+/month before any data fees

**Verdict:** Wrong product for this use case. ICE is designed for Tier-1 global banks. DSE EoD data from ICE costs enterprise rates for data that is freely available on DSE's own website. Do not use.

---

### EODHD (EOD Historical Data)

**Important:** The `.DSE` ticker suffix in EODHD refers to the **Dar es Salaam Stock Exchange (Tanzania)**, not Dhaka. EODHD does **not** cover the Dhaka Stock Exchange. Do not use.

---

## Community and Scraper Options

### bdshare (PyPI) — Best Community Option

```bash
pip install bdshare
```

- Author: rochi88 | License: MIT | Python ≥ 3.9
- Last updated: **February 22, 2026** (actively maintained)
- 149 commits, 40 stars

**Data available:**
- Current trade data: LTP, High, Low, Close, Volume, Trade count
- Historical OHLCV
- Market indices: DSEX, DSES, DS30, DGEN
- Market depth (Level 2 visible on DSE website)
- Company PE ratios
- News and announcements
- Top gainers/losers

**Technical design:**
- HTTP scraping of DSE public pages via `requests` + `lxml`/`BeautifulSoup`
- Built-in sliding window rate limiter: 5 calls/second with exponential backoff
- Configurable TTL caching (30s for live data, up to 24h for static)

**ToS status:** Scrapes publicly accessible DSE pages. DSE's terms prohibit reproduction/redistribution of "trade data, live ticker" without permission. Personal and research use is a gray area; commercial use (building a product on scraped data) is a legal risk.

**Acceptable use for StockNow:**
- ML model development and backtesting
- Internal prototyping
- NOT for production data serving to external users

---

### Other Community Projects (Status as of Early 2026)

| Project | Language | Status | Notes |
|---------|----------|--------|-------|
| `bd-stock-api` (faysal515) | TypeScript/Node.js | Abandoned (Jan 2024) | Broken |
| `Dhaka-Stock-Exchange` (ShanjinurIslam) | JavaScript | Dead (Sep 2020) | Broken |
| `stocksurferbd` (PyPI) | Python | Unknown | DSE + CSE data |
| Bangladesh Stock Market (RapidAPI) | REST | Unknown | Likely scraped wrapper, unreliable |
| `bdstockexchange` (Go) | Go | Inactive (May 2021) | |
| `bdfinance` (PyPI) | Python | Very new (Mar 2026) | 0 stars, unverified |

Do not use any of these in production.

---

### AmarStock Internal API

The AmarStock website source code reveals an internal API at `https://apiv2.amarstock.com`. It is:
- Not publicly documented
- No developer portal or published auth scheme
- B2B licensing may be possible by contacting AmarStock directly

---

### DSE quotes.txt (Most Stable Public Endpoint)

`https://www.dsebd.org/datafile/quotes.txt`

- Plain-text file, two columns: instrument code + last trade price
- Updated periodically during market hours
- No authentication required
- The most API-like endpoint DSE currently exposes publicly
- Suitable for: basic price polling in development, as a supplement to bdshare

---

## DSE Terms of Service Summary

DSE has no `robots.txt` (404). However, `dsebd.org/termsacond.htm` states:
- Reproduction of "trade data, live ticker, and graphics" is **prohibited** without written permission
- Unauthorized copying of the source code or materials may result in legal action
- Scraping for personal/internal research: gray area
- Building a commercial product that redistributes scraped DSE data: **legally risky**

---

## Phased Data Strategy

### Phase 1 — Development (Immediate, Free)

| Source | Use |
|--------|-----|
| `bdshare` Python library | ML feature engineering, backtesting, prototyping |
| `dsebd.org/datafile/quotes.txt` | Basic price polling during development |
| `dsestocks.com/dse-csv-data/` | Historical OHLCV training data (1999–2023) |
| DSE Data Archive (dsebd.org) | Recent 2-year historical data |

This is development-only. Do not serve this data to external users in production.

---

### Phase 2 — Pre-Launch (Weeks, Low Cost)

**Action: Contact DSE for iMDS commercial license**

```
To: info@dse.com.bd
Subject: Commercial Data License Inquiry — iMDS and EOD Products

We are developing StockNow, a retail investor analytics platform for the DSE.
We would like to discuss:
1. Commercial licensing for the iMDS delayed market data feed
2. EOD data product licensing
3. Connection protocol specification and technical requirements

Please advise on the application process and pricing.
```

**What this gives you:**
- Delayed (10–20s) aggregate OHLCV — legally licensed, reliable
- Displayed with a visible delay disclaimer: "Prices delayed 15-20 seconds"
- Sufficient for a retail investor product in Phases 1–3

---

### Phase 3 — Scale (Months, Requires Broker Partnership)

**Action: Identify a TREC partner for ITCH data access**

Target TREC holders who are FIX-certified and tech-forward:
- LankaBangla Securities (has its own OMS, Direct FN platform)
- IDLC Securities (mutual fund focus, but tech-capable)
- MTB Securities

**Partnership structure:**
1. Identify willing TREC partner
2. TREC partner requests DSE written approval to share ITCH data with StockNow
3. Negotiate revenue share or per-connection licensing fee
4. Receive real-time Level 1 (sub-second) ITCH data stream

**What this gives you:**
- True real-time, sub-second price updates
- Level 1 order book data (bid/ask)
- Enables VIP tier real-time pricing feature

---

### Phase 4 — VIP / Institutional Tier

- If expanding to multi-market coverage, revisit ICE Consolidated Feed
- If transaction volume justifies it, apply for TREC membership directly (heavy regulatory and capital requirements)
- Consider Level 2 order book depth as a VIP-exclusive feature once ITCH partnership is live

---

## Integration Architecture: Data Ingestion Pipeline

```
Source
  Phase 1: bdshare polling (5-30s interval) → Python ingest script
  Phase 2: DSE iMDS connection → licensed feed adapter
  Phase 3: TREC partner ITCH → binary ITCH parser
       ↓
Kafka Producer
  Topic: tick.raw
  acks=all, replication=3, enable.idempotence=true
       ↓
Kafka Consumers (parallel)
  Consumer A: QuestDB writer (raw tick storage)
  Consumer B: OHLCV bar aggregator (1m, 5m, 1D) → TimescaleDB
  Consumer C: Price normalizer → Redis PUBLISH price:{symbol}
              ↓
              WebSocket / SSE Gateway → Browser
  Consumer D: Alert engine (compare against user-defined thresholds)
  Consumer E: ML feature pipeline trigger (end-of-day batch)
```

### Redis Price Cache Pattern

```python
# On each price tick
redis.set(f"price:{symbol}", json.dumps({
    "ltp": 152.34,
    "change_pct": 1.2,
    "volume": 45000,
    "timestamp": "2026-04-02T10:30:00Z"
}), ex=10)  # 10-second TTL

# SSE broadcaster reads from Redis
async def price_stream(symbol: str):
    while True:
        price = redis.get(f"price:{symbol}")
        if price:
            yield f"data: {price}\n\n"
        await asyncio.sleep(1)
```

---

## Data Latency by Phase

| Phase | Source | Latency | Legal Status |
|-------|--------|---------|--------------|
| Development | bdshare scraper | 5–60s | Gray area (research only) |
| Pre-launch | DSE iMDS | 10–20s | Licensed, compliant |
| Scale (Free tier) | DSE iMDS | 10–20s | Licensed, compliant |
| Scale (VIP tier) | TREC ITCH | <1s | Licensed with DSE approval |
| Future | Direct TREC membership | <100ms | Full licensed access |

---

## Decision Matrix

| Scenario | Recommended Source |
|----------|--------------------|
| Building ML models now | bdshare + historical CSVs |
| Launching product (free tier) | DSE iMDS license |
| Launching product (VIP real-time) | DSE iMDS + TREC ITCH partnership |
| International multi-market expansion | ICE Consolidated Feed |
| Institutional/HFT tier | Direct TREC membership |
| Academic/research use | DSE Data Archive (free) |

---

## Immediate Action Items

1. **Email `info@dse.com.bd` today** — request iMDS commercial license terms and EOD data pricing
2. **Install bdshare** for ML development: `pip install bdshare`
3. **Use `quotes.txt`** as a supplementary machine-readable price feed during development
4. **Download historical CSVs** from `dsestocks.com/dse-csv-data/` for training data
5. **Identify 2-3 TREC partners** to approach for future ITCH data sharing agreement
6. **Do not use ICE or EODHD** — wrong products for DSE Bangladesh
