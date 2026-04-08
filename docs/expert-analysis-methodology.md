# Professional Stock Analysis Methodology

Research compiled for Stock Peak's analysis engine.

## 1. Daily Pre-Market Routine

What a professional checks every morning, 15-30 minutes before market opens:

1. **Global Overnight Cues (2 min)** — US futures (S&P 500, Nasdaq), Asian closes (Nikkei, Hang Seng), crude oil, gold, USD/BDT
2. **Macro Calendar (2 min)** — CPI, GDP, central bank decisions, earnings reports due today
3. **Overnight News (3 min)** — Geopolitical events, regulatory changes, analyst upgrades/downgrades
4. **Pre-Market Movers (5 min)** — Stocks gapping >2% on volume. Why: earnings, news, or sector sympathy?
5. **Own Portfolio Review (3 min)** — Open positions at stop-loss? Near targets? Buying power status.
6. **Key Levels Markup (5 min)** — Support/resistance on watchlist, VWAP from previous session

## 2. Macro Analysis

**Economy-Level Signals:**
- GDP accelerating → favor cyclicals (industrials, financials)
- GDP decelerating → favor defensives (utilities, healthcare)
- CPI > 5% → hawkish central bank → bearish for growth stocks
- Interest rate hikes: every 100bps rise in 10-year yield compresses P/E by ~1.5 points
- Credit spreads widening > 500bps → stress signal

**Sector Rotation (6 phases):**
1. Bullish → cyclicals and growth
2. Warning → reduce high-beta, build cash
3. Distribution → rotate to defensives
4. Bearish → max defense (cash, bonds)
5. Recovery → early-cycle sectors (financials, real estate)
6. Accumulation → beaten-down cyclicals

**Bangladesh-Specific Macro:**
- US Fed policy (strongest external influence)
- Commodity prices (oil, gas, cotton — import cost impact)
- BDT exchange rate stability
- Remittance flow data (unique to Bangladesh economy)
- FII/FPI inflow/outflow

## 3. Technical Screening — Specific Numbers

### Tier 1: Trend Identification (Moving Averages)
- **EMA 9/21 crossover**: Short-term entry signal
- **EMA 50**: Medium-term trend filter. Price above = uptrend intact
- **SMA 200**: Long-term trend. Above = bull market
- **Golden Cross**: 50 SMA crosses above 200 SMA (bullish)
- **Death Cross**: 50 SMA crosses below 200 SMA (bearish)
- **Professional filter**: Only long when ALL short-term MAs (8, 21, 50 EMA) are above 200 EMA
- **ADX filter**: ADX < 25 = range-bound, ignore crossover signals

### Tier 2: Momentum & Oscillators

**RSI (Relative Strength Index):**
- 14-period standard. Overbought > 70, Oversold < 30
- Professional: RSI(7) for faster signals. Extreme > 80 or < 20 for reversals
- RSI crosses above 50 = entry signal (773% cumulative return in backtests)
- RSI divergence (price new high, RSI lower high) = powerful reversal signal

**MACD:**
- Standard: 12-26-9
- Professional: MACD 3-10-16 for pullback trades
- Buy: MACD crosses above signal + histogram flips positive
- Combined RSI + MACD: ~77% win rate

**Bollinger Bands:**
- 20-period SMA, 2 standard deviations
- Band squeeze (narrowest in 6 months) = imminent breakout
- Price at lower band + RSI < 30 = potential long
- Price riding upper band with expanding bands = strong uptrend (do NOT short)

### Tier 3: Volume Analysis

**Volume Confirmation Rules:**
- Valid breakout: Volume > 150% of 20-day average
- Suspect breakout: Volume below average = likely false
- Climax volume (>300% average) at resistance = potential exhaustion

**VWAP:**
- Price above VWAP = bullish intraday. Below = bearish
- Institutional benchmark for execution quality

### Tier 4: Fibonacci Retracement
- Key levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%
- Strong trends: pullbacks stall at 38.2%
- 61.8% = last line of defense before reversal
- Best setup: Fibonacci level + MA confluence + oversold RSI

### Tier 5: Volatility (ATR)
- 14-period. Used for stop-loss placement and position sizing
- ATR expanding = increasing volatility, widen stops
- ATR contracting = expect breakout

## 4. Fundamental Filtering

### Pass/Fail Criteria

| Metric | Acceptable | Disqualifying |
|--------|-----------|---------------|
| P/E | 5-25 (sector-dependent) | > 40 without >30% growth |
| P/B | < 3.0 (banks < 1.5) | > 5.0 |
| Debt/Equity | < 1.0 | > 2.0 with declining revenue |
| ROE | > 14% (3-year avg) | < 8% consistently |
| EPS Growth | > 10% YoY | Negative 2+ consecutive years |
| Free Cash Flow | Positive and growing | Negative 3+ years |
| Current Ratio | > 1.5 | < 1.0 |
| Interest Coverage | > 3x | < 1.5x |

### Immediate Disqualifiers (Red Flags):
- Negative FCF for 3+ consecutive years
- D/E > 2.0 with declining revenue
- Qualified audit opinion or auditor change
- Promoter pledge > 50% of holdings
- Z-category on DSE
- Revenue declining 3+ quarters without restructuring

## 5. Sentiment & Flow Analysis

- **Institutional flow**: FII/FPI net outflow for 5+ sessions = bearish
- **Block deals**: Repeated institutional buying > 1% of company = accumulation
- **Insider buying**: CEO/CFO buying > $500K = strong conviction. Multiple insiders simultaneously = strongest signal
- **Insider evidence**: Buying only when insiders also buying returned 145% vs 30% for buy-and-hold
- **Social sentiment**: > 60% bulls = potential top. < 20% bulls = potential bottom
- **Bangladesh-specific**: Monitor BSEC announcements daily, sponsor/director transactions, BO account trends, margin loan utilization

## 6. Risk Management

### Position Sizing
```
Position Size = (Account Value x Risk%) / (Entry - Stop Loss)
Standard risk: 1-2% per trade, never exceed 2%
```

### Stop-Loss (ATR-based)
```
Stop Loss = Entry - (ATR x Multiplier)
Day trade: 1.5-2x ATR
Swing trade: 2-3x ATR
Position trade: 3-4x ATR
```

### Chandelier Exit (Trailing Stop)
```
Trailing Stop = Highest High (22) - 3 x ATR(22)
```

### Portfolio Rules
- Single position: max 5% of portfolio (10% absolute max)
- Single sector: max 10% of portfolio
- Cash reserve: 10-20%
- Daily loss limit: 3-5% → stop trading
- Portfolio drawdown 10-15% → close all, pause 2 weeks

### Risk-Reward
- Minimum: 1:2 (risk $1 to make $2)
- Target: 1:3 or better
- Never take: below 1:1.5
- At 1:2 R:R, you only need 34% win rate to break even
- At 1:3 R:R, you only need 26% win rate to break even

## 7. Recommendation Format

```
ACTION: BUY / SELL / HOLD
STOCK: [Name] ([Ticker])
CMP: [current price]
ENTRY RANGE: [lower] - [upper]
TARGET 1: [price] (+X%)
TARGET 2: [price] (+X%)
STOP LOSS: [price] (-X%)
TIMEFRAME: Intraday / Swing / Short-term / Positional
RISK-REWARD: 1:X
RISK RATING: Low / Moderate / High
RATIONALE: [specific triggers]
```

## 8. What Makes It Not Gambling

### Expectancy Formula
```
Expectancy = (Win% x Avg Win) - (Loss% x Avg Loss)
```
Positive expectancy = the system makes money over time.

**Example**: 40% win rate, avg win $300, avg loss $100:
```
(0.40 x 300) - (0.60 x 100) = $120 - $60 = +$60 per trade
```
Even losing 60% of trades, you profit $60/trade on average.

### Profit Factor
```
Profit Factor = Gross Profits / Gross Losses
> 1.5 = solid, > 2.0 = excellent, < 1.0 = losing
```

### Key Difference
| Gambling | Professional Trading |
|----------|---------------------|
| Fixed negative expectancy | Positive expectancy through edge |
| No risk control | Stop-loss on every trade |
| Outcome independent of skill | Skill improves outcomes |
| No compounding of edge | Kelly criterion compounds edge |

## 9. AI/ML That Actually Works

**What produces real alpha:**
1. **XGBoost / Gradient Boosted Trees**: Workhorse of quant finance. Outperforms deep learning on tabular financial data.
2. **Ensemble methods**: Dozens of mediocre signals combined into robust composite. The actual secret of most quant funds.
3. **FinBERT / NLP**: Sentiment scoring of earnings calls, news. 81.83% accuracy.
4. **Hybrid systems**: Technical + ML + sentiment + regime detection. Sharpe > 2.5, max drawdown ~3%.

**Feature importance ranking:**
- Trend features: 59.35% of total importance
- 6-month return alone: 14.69%
- Moving averages, RSI, MACD as features
- Volume ratios, sector-relative performance

**What does NOT work:**
- Pure LSTM on raw prices (overfits)
- Transformers on price alone
- Any model without market regime detection
- Alpha from published signals decays ~60% post-publication

## 10. DSE/Bangladesh Specifics

### Trading Categories
- **A**: Regular AGM + dividend >10%. T+2 settlement.
- **B**: Regular AGM + dividend <10%. T+2.
- **Z**: AGM default, losses, negative retained earnings. **T+9 settlement.** AVOID.

### Circuit Breakers
- Upper: +10% from previous close
- Lower: -5% (asymmetric — slows crashes)
- New listings: no circuit for first 5 days

### Manipulation Patterns
- Circular trading (artificial volume among connected accounts)
- Pump and dump on Z-category stocks
- Volume spike >500% without news = suspicious
- Price at upper circuit on low volume = suspect
- Price rising but volume declining = distribution

### Key DSE Facts
- DSE is NOT efficient (weak-form or semi-strong). Technical analysis has MORE predictive power here than on US markets.
- Fundamental mispricing persists longer → bigger value opportunities
- Average daily turnover is low. Many stocks trade <$10K/day.
- Bid-ask spreads 2-5% on small caps
- Minimum 20% free float required but many have effective 10-15%
- BSEC enforcement: reactive, not proactive. Fines imposed but <1% recovered.

### Practical Adjustments for DSE
- Wider stops (ATR 3-4x) for higher volatility
- Reduce position sizes 50% vs developed market norms
- Avoid stocks with daily volume < ৳5 lakh
- Focus on A-category stocks only for systematic trading
- Monitor BSEC announcements daily (can move stocks 10-20%)
- Weight fundamental analysis more heavily (market inefficiency = fundamental edge)
- Track remittance flow as unique macro indicator
