# Stock Peak — TODO

## Architecture (completed)

- [x] Split pipeline into 3 isolated stages: prepare_candidates → generate_picks_llm → store_picks
- [x] Isolate all LLM code to `generate_picks_llm.py` (single anthropic import point)
- [x] Separate branches: `main` (view-only Next.js app) / `llm-pipeline` (data pipeline)
- [x] DSE daily snapshots persisted to DB (`dse_daily_snapshots`) + filesystem cold archive
- [x] Failure analysis logging to `logs/failure-analysis/YYYY-MM-DD.md` after EOD
- [x] Multi-agent bull/bear dialectical debate (`multi_agent.py`, opt-in via MULTI_AGENT=1)
- [x] Outcome tracker resolves target_hit / stop_hit / expired from OHLCV data
- [x] Risk-tier classification: conservative / moderate / aggressive per stock
- [x] Risk profiling questionnaire + 30-day lock on re-assessment

---

## Broker Context Gaps — Technical Debt (P0)

The LLM generates picks in a single-day vacuum. It sees ~33 current indicator fields
but has zero awareness of its own track record or historical patterns. These gaps must
be closed for the system to improve over time.

### Gap 1: No outcome feedback loop
- LLM never sees past pick results (target_hit / stop_hit / expired)
- Data exists: `pick_outcomes` table (exit_price, gain_pct, exit_date, holding days)
- Impact: can't learn "my MACD-crossover picks hit stop 40% of the time"
- Fix: query last N resolved picks, pass aggregate stats + per-ticker history into prompt

### Gap 2: No historical self-awareness
- LLM doesn't know its own win rate, average gain, or confidence calibration
- Data exists: computable from `picks` + `pick_outcomes` join
- Impact: confidence scores are uncalibrated (8/10 picks may perform same as 5/10)
- Fix: pass rolling win rate, avg gain, confidence-to-outcome correlation into prompt

### Gap 3: No per-ticker track record
- LLM doesn't know "I picked MONOSPOOL 3 times, hit target twice, stop once"
- Data exists: `picks` table filtered by ticker + `pick_outcomes`
- Impact: may repeatedly recommend a stock it consistently gets wrong
- Fix: for each candidate, include past picks for that ticker with outcomes

### Gap 4: No indicator-to-outcome correlation
- LLM can't see "when RSI was 55-60 and I picked, 70% hit target; when RSI > 70, only 30%"
- Data exists: `dse_daily_snapshots` (indicators on pick date) + `pick_outcomes`
- Impact: no evidence-based indicator thresholds, relies purely on textbook rules
- Fix: pre-compute indicator-outcome correlation stats, pass as context

### Gap 5: Failure analysis not fed back
- Detailed failure post-mortems exist at `logs/failure-analysis/YYYY-MM-DD.md`
- Contains: original reasoning, indicators at pick time, what went wrong
- Currently: write-only. Nothing reads these back into the generation prompt.
- Fix: parse recent failure logs, extract recurring patterns, inject as warnings

### Gap 6: Only moderate risk tier surfaced
- All 3 tiers (conservative / moderate / aggressive) are computed and stored in `risk_annotations` JSONB
- LLM prompt only surfaces the moderate-tier score and signal
- Impact: can't tailor picks per user risk profile
- Fix: pass all 3 tier classifications into prompt, let LLM reason per tier

### Gap 7: No portfolio context
- LLM picks 3 stocks in isolation with no awareness of user holdings
- Data exists: `portfolio_snapshots` (holdings, correlation matrix, VaR, drawdown)
- Impact: may recommend stocks highly correlated with user's existing positions
- Fix: for personalized picks, pass portfolio summary + correlation warnings

### Gap 8: No market-condition-to-outcome correlation
- LLM sees today's market mood but doesn't know "when mood was bearish and I picked anyway, stops hit 60%"
- Data exists: `dse_daily_snapshots.market_summary` + `pick_outcomes`
- Impact: no learned caution during specific market regimes
- Fix: compute mood-outcome stats, pass as context ("bearish-day picks: 35% win rate")

---

## Data Quality (P0)

- [ ] Run POC during live DSE market hours (10:00-14:30 BDT) to verify bdshare returns real-time vs cached data
- [ ] Add data timestamp verification — check if scraped data matches today's trading session
- [ ] Validate bdshare data against DSE official website (dse.com.bd) for at least 10 stocks
- [ ] Historical backtest: compare our screen output against past StockLens BD picks (need to subscribe and collect their picks for 2 weeks)
- [ ] DSEX index comparison — track whether our picks beat the broad index over time
- [ ] Add sanity checks in pipeline: reject data if 0 declining stocks, if all changes are positive, or if data looks stale
- [ ] Test alternative data sources: direct DSE scraping, stockbangladesh.com, amarstock.com

## Prediction Quality (P0)

- [x] Dark launch: Day 1 complete (3 picks stored, idempotency verified)
- [ ] Dark launch: run during live trading hours Days 2-3
- [ ] Cross-verify each day's picks against community sentiment (Facebook groups, Telegram channels, DSE forums)
- [ ] Compare against StockLens BD picks daily (both use AI, see who performs better)
- [ ] Add sector analysis to screening (banking, pharma, textile, etc. — weight sectors by recent momentum)
- [ ] Historical RSI/SMA data: bdshare historical endpoint times out from local machine. Try from VM or use alternative source.
- [ ] Confidence score calibration: track whether 8/10 picks actually hit target more than 6/10 picks

## Auth & User Features (P1)

- [x] Risk profiling questionnaire with Bengali/English bilingual UI
- [x] Risk profile badge in dashboard nav
- [ ] Forgot password flow (email-based token reset)
- [ ] Email verification on signup
- [ ] Google OAuth (needs Google Cloud project credentials)
- [ ] Logout button in dashboard/portfolio nav
- [ ] User profile page (edit name, phone, manage subscription)

## Missing Features vs StockLens BD (P1)

- [ ] AI stock search (free instant analysis on homepage — key conversion funnel)
- [ ] Dark mode (StockLens BD defaults to dark theme)
- [ ] Technical analysis dashboard with charts
- [ ] Live chat support widget
- [ ] Facebook Pixel / analytics tracking

## Payment (P1)

- [ ] SSLCommerz integration (apply for merchant account)
- [ ] bKash merchant API (4-8 week approval, apply NOW)
- [ ] Gate Pro features behind subscription after trial expires
- [ ] Trial expiry email notifications (Day 5, Day 7, Day 8, Day 14)

## Delivery Channels (P2)

- [ ] Telegram bot (@StockPeakBD) — /today, /history, /subscribe commands
- [ ] Email delivery via Resend — daily picks + weekly report templates
- [ ] WhatsApp Business API (apply, implement after Telegram works)

## Infrastructure (P2)

- [x] Removed GitHub Actions daily-picks workflow (pipeline moved to llm-pipeline branch)
- [ ] Fix GitHub Actions deploy — env vars must come from /root/.stockpeak.env on VM, not from GitHub secrets (partially fixed)
- [ ] Add health check endpoint (/api/health) for monitoring
- [ ] Set up error logging (Sentry or similar)
- [ ] Timezone handling: server runs UTC, picks should use BDT (UTC+6). Standardize.
- [ ] Container timezone: set TZ=Asia/Dhaka in Dockerfile
- [ ] Get real CLAUDE_API_KEY from console.anthropic.com (OAuth token works on haiku only, rate-limited)
- [ ] Paperclip integration: replace generate_picks_llm.py with Claude Code agent (Stage 2)

## Future (P3)

- [ ] Custom ML models (XGBoost/LightGBM) to replace/augment LLM picks
- [ ] Portfolio P&L tracking with live prices
- [ ] Stock screener
- [ ] Weekly market report (automated Saturday email)
- [ ] Exit alerts (intraday price monitoring)
- [ ] PWA with push notifications
- [ ] BSEC Investment Adviser registration
- [ ] Claude Code skills for broker workflows (/broker-picks, /broker-eod, /broker-day)
