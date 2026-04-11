# Professional Broker/Consultant — Deep Research Report

**Date:** April 10, 2026
**Purpose:** Define how Stock Peak should operate as a professional AI broker/consultant agent for DSE

---

## 1. Client Profiling & Risk Assessment

Professional brokers **must** profile every client before recommending anything (FINRA Rule 2090/2111). They use a scored questionnaire (7-12 questions) covering:

- **Investment horizon** — short (<3yr), medium (3-10yr), long (>10yr)
- **Risk tolerance** — "If your portfolio dropped 20%, would you sell, hold, or buy more?"
- **Capital & income** — how much to invest, liquidity needs
- **Experience level** — none, limited, moderate, extensive
- **Goal** — capital preservation, income, growth, speculation

### Risk Profile Tiers

Scores map to **5 tiers** (Stock Peak will use 3: Conservative, Moderate, Aggressive):

| Profile | Equities | Max Single Stock | Max Sector | Stop Tightness |
|---------|----------|-----------------|------------|----------------|
| Conservative | 20-30% | 5-10% | 25% | Tight (1x ATR) |
| Moderately Conservative | 30-40% | 10% | 25% | Moderate |
| Moderate | 50-60% | 10-15% | 30% | Standard (1.5x ATR) |
| Moderately Aggressive | 70-80% | 15% | 40% | Loose (2x ATR) |
| Aggressive | 85-95% | 20% | 50% | Wide (2x ATR) |

### Model Portfolio Allocations

| Profile | Equities | Bonds/Fixed Income | Cash/Alternatives |
|---------|----------|--------------------|-------------------|
| Conservative | 20-30% | 60-70% | 5-10% |
| Moderately Conservative | 30-40% | 50-60% | 5-10% |
| Moderate | 50-60% | 35-45% | 5-10% |
| Moderately Aggressive | 70-80% | 15-25% | 5% |
| Aggressive | 85-95% | 5-10% | 0-5% |

### Same Stock, Different Signal

The **same stock** gets different signals per profile:
- RSI 72 stock = **SELL** for conservative (overbought, too risky)
- RSI 72 stock = **HOLD** for moderate (momentum valid but stretched)
- RSI 72 stock = **BUY** for aggressive (riding momentum with wider stop)

### Risk Profile Parameters (Stock Peak Implementation)

```python
RISK_PROFILES = {
    "conservative": {
        "max_single_position_pct": 10,
        "min_liquidity_mn": 5.0,
        "max_volatility_pct": 15,
        "preferred_signals": ["STRONG BUY"],
        "stop_loss_multiplier": 1.0,
        "target_multiplier": 2.0,
        "max_holdings": 8,
        "sector_concentration_limit": 0.30,
        "min_rsi": 35, "max_rsi": 60,
    },
    "moderate": {
        "max_single_position_pct": 15,
        "min_liquidity_mn": 2.0,
        "max_volatility_pct": 25,
        "preferred_signals": ["STRONG BUY", "BUY"],
        "stop_loss_multiplier": 1.5,
        "target_multiplier": 2.5,
        "max_holdings": 12,
        "sector_concentration_limit": 0.40,
        "min_rsi": 30, "max_rsi": 65,
    },
    "aggressive": {
        "max_single_position_pct": 20,
        "min_liquidity_mn": 0.5,
        "max_volatility_pct": 40,
        "preferred_signals": ["STRONG BUY", "BUY", "HOLD"],
        "stop_loss_multiplier": 2.0,
        "target_multiplier": 4.0,
        "max_holdings": 15,
        "sector_concentration_limit": 0.50,
        "min_rsi": 25, "max_rsi": 75,
    },
}
```

---

## 2. Client Notification System

### 2.1 Real-Time / Same-Day Alerts

| Trigger | Threshold | Severity |
|---------|-----------|----------|
| Unusual price move | ±5% intraday | WARNING |
| Significant price move | ±10% intraday | CRITICAL |
| 52-week high/low breach | New 52-week extreme | INFO |
| Unusual volume | 2x-3x 20-day average | WARNING |
| Stop-loss hit | Price ≤ stop level | CRITICAL |
| Approaching stop-loss | Within 2% of stop level | WARNING |
| Target price hit | Price ≥ target | INFO |
| Earnings release | Same-day for held stocks | INFO |
| Analyst rating change | Same-day | INFO |
| Portfolio drawdown -5% | Portfolio down 5% from peak | WARNING |
| Portfolio drawdown -10% | Portfolio down 10% from peak | CRITICAL |
| Portfolio drawdown -15% | Portfolio down 15% from peak | CRITICAL |
| Portfolio drawdown -20% | Portfolio down 20% from peak | EMERGENCY |
| Position concentration | >10-15% of portfolio | WARNING |
| Sector concentration | >25-30% of portfolio | WARNING |
| Market circuit breaker | DSE index drops 2%+ | CRITICAL |
| VIX/volatility spike | VIX crosses 20, 25, 30, 40 | WARNING-CRITICAL |

### 2.2 Scheduled Communications

| When | Type | Content |
|------|------|---------|
| **6:00-7:30 AM BDT** (pre-market) | Morning Brief | Global overnight markets, BD financial news, BSEC announcements, expected market mood, daily watchlist, today's catalysts |
| **After close (3:30 PM BDT)** | EOD Summary | Day's P&L per position + portfolio, notable moves, orders executed, after-hours developments, tomorrow's preview |
| **Thursday/Friday** | Weekly Digest | Week-over-week performance, top 3-5 gainers/losers, upcoming catalysts, next week's economic calendar, rebalancing recommendations |
| **1st of month** | Monthly Report | Total returns vs DSEX benchmark, asset allocation snapshot, individual holding performance, dividends received, risk metrics (beta, drawdown) |
| **Quarterly** | Performance Review | Time-weighted returns, attribution analysis, Sharpe ratio, Sortino ratio, max drawdown, strategic review, goal progress |
| **Annually** | Annual Review | Comprehensive performance, peer comparison, plan update, risk profile reassessment |

### 2.3 Proactive Advisory Notifications (Not Waiting for Client)

- Stock drops **10%+ in one day** or **20% from purchase price**
- Major corporate event (M&A, fraud, CEO departure)
- Market correction territory (index -10% from peak)
- Bear market territory (index -20% from peak)
- Portfolio significantly underperforms DSEX benchmark for the quarter
- Rebalancing needed (allocation drifts >5% from target)
- Pre-earnings reminder **1-3 business days** before held stock reports
- New opportunity matching client's profile criteria
- Dividend declaration for held stocks (ex-date, pay date)

### 2.4 Market Downturn Communication Escalation

| Market Drop | Communication |
|-------------|---------------|
| -5% to -7% from peak | No special communication |
| -10% (correction) | First proactive message — "Markets are down, here's context" with historical recovery data |
| -15% | Follow-up with detailed analysis, add friction to panic selling |
| -20% (bear market) | CEO-level communication, personalized messaging, "what if you sold vs stayed" projections |
| -30%+ | Daily communications, highlight buying opportunities |

---

## 3. Trade Recommendation Workflow

### 3.1 Professional Daily Routine

**Pre-Market (6:00 AM - Market Open):**
1. Review overnight global markets, economic calendar
2. Run screeners for stocks meeting entry criteria
3. Build daily watchlist from screener results
4. Generate morning brief with top ideas

**Market Hours (10:00 AM - 2:30 PM BDT):**
5. Monitor watchlist for entry triggers
6. Execute/recommend trades when criteria met
7. Track stop-losses and targets on open positions
8. Monitor market breadth for mood shifts

**Post-Market (3:00 PM+):**
9. Review day's trades, update outcome journal
10. Run EOD screeners for next day's watchlist
11. Generate EOD summary for clients
12. Compute daily P&L and win rate

### 3.2 Entry Criteria

- Price action patterns (breakouts, pullbacks to support)
- Technical indicator confirmations (EMA crossovers, RSI oversold <30 or overbought >70, MACD turns)
- Volume confirmation (volume exceeding 2x recent average during breakout)
- Fundamental catalysts (earnings beats, new contracts, management changes)
- Risk/reward ratio of at least **2:1**, preferably **3:1**
- Minimum 3 confirming signals required (DSE frontier market defense)

### 3.3 Exit Criteria

- **Stop-Loss:** Non-negotiable, set before entry. ATR-based (1-2x ATR)
- **Profit Targets:** Pre-determined based on resistance levels or ATR multiples
- **Time-Based Exit:** If trade hasn't moved in expected direction within defined timeframe
- **Trailing Stops:** Lock in profits as position moves favorably
- **Changed Thesis:** Exit if fundamental reason for trade is invalidated

### 3.4 Position Sizing

- Never risk more than **1-2% of total portfolio** on a single trade
- Single stock concentration: **max 10-15%** of portfolio
- Sector concentration: **max 25-30%** of portfolio
- Typical professional portfolios: **20-50 individual positions**

---

## 4. Portfolio & Risk Management

### 4.1 Rebalancing (Hybrid Approach — Industry Best Practice)

Check weekly, but only rebalance when:
- **5% absolute drift** from target allocation (e.g., 60% target → triggers at 55% or 65%)
- **25% relative drift** at sub-asset class level
- Rebalance via new cash inflows first before selling

### 4.2 Drawdown Protocol (Escalating Defense)

| Portfolio Drop | Action |
|----------------|--------|
| -10% from peak | Review & tighten all stop-losses |
| -15% from peak | Reduce equity exposure by 25-30% |
| -20% from peak | Maximum defensive posture |

### 4.3 Cash Buffer Strategy

- Minimum **5% cash** at all times (liquidity + opportunity fund)
- Increase to **10-15%** when markets appear overvalued or volatile
- Increase to **20-30%** when recession/crash signals appear
- Deploy cash systematically into weakness (dollar-cost averaging)

### 4.4 Correlation Monitoring

- Alert when holdings correlation exceeds **0.70** (moderate risk)
- Alert when holdings correlation exceeds **0.85** (high risk — recommend replacing one)
- Goal: maintain diversified portfolio with low inter-holding correlation

### 4.5 Value at Risk (VaR)

Three methods:
- **Historical VaR:** Sort returns, take percentile (simplest)
- **Parametric VaR:** Assume normal distribution
- **Monte Carlo VaR:** Simulate 10,000 scenarios

Use 95% confidence level. Report: "With 95% confidence, maximum expected loss is X% in a single day."

### 4.6 Black Swan Protection (DSE-Adapted)

Since DSE lacks options/derivatives:
- Position sizing is the **primary defense**
- Keep 15% minimum in cash/FD always
- Never >10% in one stock
- If DSEX drops 2%+: reduce exposure 25%
- If DSEX drops 5%+: move to 50% cash
- 5 consecutive red days: full defensive posture
- No sector >30%

---

## 5. Performance Tracking & Reporting

### 5.1 Key Metrics

**Return Metrics:**
- Total return (absolute)
- Time-weighted return (TWR) — isolates investment performance from cash flows
- Alpha — outperformance vs DSEX index

**Risk-Adjusted Metrics:**
- **Sharpe Ratio:** >1.0 good, >2.0 excellent, >3.0 exceptional
- **Sortino Ratio:** Focuses on downside volatility only
- **Maximum Drawdown:** Largest peak-to-trough decline
- **Beta:** Portfolio sensitivity to DSEX movements

**Trade Metrics:**
- Win rate (% of profitable trades)
- Average gain vs average loss
- Profit factor (gross profit / gross loss)
- Risk-reward ratio achieved vs planned

### 5.2 Benchmarking

- Primary benchmark: **DSEX index**
- Secondary: **DS30 index** (top 30 stocks)
- Absolute target: **inflation + 5%** (Bangladesh CPI + 5%)

---

## 6. DSE-Specific Rules & Considerations

### 6.1 Critical DSE Rules

| Rule | Detail |
|------|--------|
| Circuit breaker | ±10% daily price limit (BSEC can change) |
| Settlement | T+2 — cannot sell same-day purchase |
| Trading hours | Pre-open 9:30-10:00, Continuous 10:00-14:30 |
| Post-close | 14:30-14:40 (closing price determination) |
| IPO exception | No circuit breaker for 2 days after listing |
| Categories | A (regular dividend), B, N, Z (irregular — **avoid**) |
| Min lot size | 1 share |

### 6.2 Liquidity Assessment (DSE-Specific)

| Daily Turnover (BDT) | Risk | Action | Max Position |
|----------------------|------|--------|-------------|
| < 5 lakh | CRITICAL | DO NOT TRADE | 0% |
| 5 lakh - 20 lakh | HIGH | Small position only | 3% |
| 20 lakh - 1 crore | MODERATE | Normal position | 8% |
| > 1 crore | LOW | Full position | 15% |

### 6.3 Frontier Market Defenses

Bangladesh equity market is classified as a **frontier market** (MSCI) with:
- High herding behavior
- Low transparency
- Information asymmetry

**Defenses:**
- Detect unusual volume with no public news (insider activity signal)
- Require **minimum 3 confirming signals** (never trade on 1 indicator)
- Skip Z-category stocks (dividend defaulters)
- Skip recently halted stocks (regulatory concern)
- Detect herd buying (>80% of market advancing = euphoria, be cautious)
- Monitor block trades (institutional flow proxy)
- Advisory stop-loss only (no automated execution — no API access on DSE)

### 6.4 No Derivatives Market

DSE has no options or futures market, which means:
- No hedging via puts/calls
- No collar strategies
- Position sizing and cash allocation are the **only** risk management tools
- Trailing stops must be advisory (manual execution by client)

---

## 7. Multi-Agent Architecture (Advanced)

Professional trading firms use specialized teams. Stock Peak should mirror this with AI agents:

| Agent Role | What It Does |
|---|---|
| Technical Analyst | RSI, MACD, Bollinger, EMAs, ATR (currently in broker_agent.py) |
| Fundamental Analyst | P/E, EPS, book value, dividend yield from DSE filings |
| Sentiment Analyst | BD news scraping (Prothom Alo, Daily Star business), social media |
| News Analyst | Macro events: policy rate, forex reserves, remittance data |
| Bull Researcher | Argues FOR the trade based on analyst inputs |
| Bear Researcher | Argues AGAINST the trade (prevents confirmation bias) |
| Risk Manager | Validates against portfolio limits, correlation, VaR |

**Key insight:** The dialectical process (bull vs bear debate) prevents the confirmation bias that single-pass scoring has.

---

## 8. Regulatory & Compliance

### Suitability Obligations (FINRA Rule 2111 equivalent)

Three layers:
1. **Reasonable-Basis:** The recommendation must be suitable for at least some investors
2. **Customer-Specific:** Must be suitable for THIS specific client
3. **Quantitative:** Recommendations must not be excessive in frequency (churning)

### Best Practices for AI Agent

- Maintain suitability documentation for every recommendation
- Disclose the AI's methodology clearly
- Track all recommendations with timestamps
- Provide clear risk warnings and disclaimers
- Record keeping: all communications, trade recommendations, client profiles
- Annual risk profile reassessment

---

## 9. Implementation Phases for Stock Peak

### Phase 1 — Client Profile System
- Risk questionnaire (5-7 questions at onboarding)
- 3 tiers: Conservative, Moderate, Aggressive
- Profile-aware signal filtering
- Position sizing per profile

### Phase 2 — Notification Engine
- Pre-market brief (6:00 AM BDT)
- Intraday monitoring every 30 min (stop-loss, volume spikes, target hits)
- EOD summary (3:30 PM BDT)
- Weekly digest (Thursday)
- Monthly performance report (vs DSEX)
- Event-driven alerts (price, volume, drawdown, concentration)

### Phase 3 — Portfolio Intelligence
- Drift detection & rebalancing advisor
- Correlation monitoring between holdings
- VaR computation
- Drawdown escalation protocol
- Liquidity-aware position sizing
- Cash management automation

### Phase 4 — Multi-Agent Analysis
- Bull case / Bear case dialectical debate via Claude API
- Fundamental data integration (P/E, EPS, book value)
- Sentiment analysis (BD news scraping)
- News analyst (macro events, BSEC announcements)

---

## Sources

- FINRA Rule 2090 (Know Your Customer) & Rule 2111 (Suitability)
- SEC Regulation Best Interest (Reg BI)
- Goldman Sachs Portfolio Construction 2026
- Morgan Stanley Portfolio Diversification Guidelines
- Vanguard Model Portfolio Allocations & Rebalancing Research
- Charles Schwab Trading Alerts System
- Fidelity Real-Time Alerts Framework
- Betterment Rebalancing & Tax-Loss Harvesting Methodology
- Wealthfront Investment Methodology
- TradingAgents: Multi-Agent LLM Financial Trading Framework (arXiv:2412.20138)
- DSE Trading Rules (dsebd.org)
- BSEC Circuit Breaker Regulations
- Morningstar Risk Profiling Framework
- Kitces: Optimal Rebalancing Frequency & Client Service Calendars
- Bangladesh Equity Market Herding Behavior Study (MDPI)
