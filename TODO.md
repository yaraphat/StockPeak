# Stock Peak — TODO

## Data Quality (P0)

- [ ] Run POC during live DSE market hours (10:00-14:30 BDT) to verify bdshare returns real-time vs cached data
- [ ] Add data timestamp verification — check if scraped data matches today's trading session
- [ ] Validate bdshare data against DSE official website (dse.com.bd) for at least 10 stocks
- [ ] Historical backtest: compare our screen output against past StockLens BD picks (need to subscribe and collect their picks for 2 weeks)
- [ ] DSEX index comparison — track whether our picks beat the broad index over time
- [ ] Add sanity checks in pipeline: reject data if 0 declining stocks, if all changes are positive, or if data looks stale
- [ ] Test alternative data sources: direct DSE scraping, stockbangladesh.com, amarstock.com

## Prediction Quality (P0)

- [ ] Dark launch: generate picks for 1-2 weeks without publishing, track accuracy internally
- [ ] Cross-verify each day's picks against community sentiment (Facebook groups, Telegram channels, DSE forums)
- [ ] Compare against StockLens BD picks daily (both use AI, see who performs better)
- [ ] Add sector analysis to screening (banking, pharma, textile, etc. — weight sectors by recent momentum)
- [ ] Historical RSI/SMA data: bdshare historical endpoint times out from local machine. Try from VM or use alternative source.
- [ ] Confidence score calibration: track whether 8/10 picks actually hit target more than 6/10 picks

## Auth & User Features (P1)

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

- [ ] Fix GitHub Actions deploy — env vars must come from /root/.stockpeak.env on VM, not from GitHub secrets (partially fixed)
- [ ] Add health check endpoint (/api/health) for monitoring
- [ ] Set up error logging (Sentry or similar)
- [ ] Timezone handling: server runs UTC, picks should use BDT (UTC+6). Standardize.
- [ ] Container timezone: set TZ=Asia/Dhaka in Dockerfile

## Future (P3)

- [ ] Custom ML models (XGBoost/LightGBM) to replace/augment LLM picks
- [ ] Portfolio P&L tracking with live prices
- [ ] Stock screener
- [ ] Weekly market report (automated Saturday email)
- [ ] Exit alerts (intraday price monitoring)
- [ ] PWA with push notifications
- [ ] BSEC Investment Adviser registration
