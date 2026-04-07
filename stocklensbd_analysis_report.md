# StockLens BD — Feature & Strategy Analysis Report

**Date:** April 5, 2026  
**URL:** https://stocklensbd.com  
**Tagline:** "স্বাগতম StockLens BD তে! প্রতিদিন সকাল ৭টায় AI স্টক পিক পাবেন। 📊"  
*(Welcome to StockLens BD! Get AI stock picks every morning at 7 AM.)*

---

## 1. Platform Overview

StockLens BD is an AI-powered stock analysis platform focused exclusively on the **Dhaka Stock Exchange (DSE)**, Bangladesh. Founded in 2025 by **Go Daily Digital**, it targets individual Bangladeshi retail investors who lack access to professional-grade analysis tools.

**Core Value Proposition:** Deliver 3 AI-analyzed stock picks daily via email and web dashboard, before market open, at an affordable price (৳299/month ~$2.70 USD).

**Technology:** Powered by **OpenAI's GPT-4o** model for stock analysis and recommendation generation.

---

## 2. Pages & Sections

| Page | URL Path | Purpose |
|------|----------|---------|
| Homepage (Landing) | `/` | Marketing, hero carousel, AI search demo, pricing teaser |
| Login | `/login` | Email/password + Google OAuth login |
| Signup | `/signup` | Registration with 7-day free trial |
| Dashboard | `/dashboard` | Main authenticated hub — daily picks, portfolio, stock search |
| About | `/about` | Company story, mission, technology details |
| Pricing | `/pricing` | Subscription plans, FAQ, payment options |
| Terms of Service | `/terms` | Legal terms |
| Privacy Policy | `/privacy` | Privacy policy |
| Disclaimer | `/disclaimer` | Investment risk disclaimer (in Bengali) |
| Forgot Password | `/forgot-password` | Password recovery |

---

## 3. Features Breakdown

### 3.1 Daily AI Stock Picks (Core Feature)

- **3 stocks picked daily** by the AI system
- Each pick includes:
  - **Stock Symbol & Company Name** (e.g., DAFODILCOM — Dafodil Communications Ltd.)
  - **Current Price** (real-time from DSE)
  - **Target Price** (AI-predicted upside target)
  - **Expected Gain %** (calculated from current to target)
  - **Signal** — Buy / Strong Buy / Hold
  - **Confidence Score** — percentage (e.g., 75%, 80%)
  - **AI Analysis Reasoning** — a paragraph explaining why the stock was picked (trend analysis, volume analysis, institutional interest signals)
- **Delivery:** Email at 7:00-7:30 AM daily + dashboard access
- **Weekly Email:** Saturday 8 PM — weekly market insights + exclusive watchlist

**Example picks on April 5, 2026:**

| # | Stock | Price | Target | Gain | Signal | Confidence |
|---|-------|-------|--------|------|--------|------------|
| 1 | DAFODILCOM | ৳85.10 | ৳93.00 | +9.28% | Strong Buy | 80% |
| 2 | EGEN | ৳22.10 | ৳24.00 | +8.60% | Strong Buy | 80% |
| 3 | TILIL | ৳45.90 | ৳50.00 | +8.93% | Strong Buy | 75% |

### 3.2 Stock Search & Analysis Engine

Users can search **any DSE stock** by symbol or company name. The analysis page shows:

- **Price Overview:** Current price, day change (%), high, low
- **Trading Data:** Volume, value (in millions), number of trades
- **30-Day Price History Chart** — line chart with date axis
- **Technical Analysis Dashboard** containing:
  - **Overall Signal** — Buy / Hold / Sell with confidence %
  - **Price Analysis** — current price, day change, position (mid/high/low range), distance from high
  - **Volume & Liquidity** — today's volume, volume status (very low/low/normal/high), liquidity rating (1-5 stars)
  - **Key Levels** — resistance, support, and target prices
  - **Technical Indicators** — RSI (14) with interpretation (overbought/neutral/oversold), trend direction (up/sideways/down), momentum
  - **AI Recommendation** — text-based actionable suggestion

**Example (GP — Grameenphone):** Signal = HOLD, Confidence 50%, RSI = 50 (Neutral), Trend = Sideways, Recommendation: "Wait for clearer signals before taking position."

### 3.3 Portfolio Tracker

- **Add stocks** to a personal portfolio from search results
- **Active Portfolio** — tracks currently held stocks
- **Sold Stocks** — history of exited positions with profit/loss
- **Market Status** indicator (Open / Closed)

### 3.4 Homepage AI Demo (Public)

- Free stock symbol search on the landing page for unauthenticated users
- Shows a teaser of AI analysis capability to drive conversions
- Daily picks shown in locked/blurred state (premium gated)

### 3.5 User Onboarding

- **Welcome modal** on first login — explains trial, shows CTA for daily insight
- **Trial countdown** banner — "Your free trial ends in X days"
- **Quick Links section** — YouTube tutorial, Facebook page, Facebook group

### 3.6 Community & Support

- **YouTube User Guide** — video tutorial
- **Facebook Page** — stocklensbd
- **Facebook Group** — community of investors
- **Live Chat widget** — "Open chat" button on homepage
- **Email Support** — support@stocklensbd.com

### 3.7 Notification System

- Marquee banner at top: "স্বাগতম StockLens BD তে! প্রতিদিন সকাল ৭টায় AI স্টক পিক পাবেন। 📊"
- Custom notice system (holiday notices, weekend notices, custom day-of-week notices)
- In-app notification panel (F8 shortcut)

---

## 4. Prediction / Stock Selection Strategy

Based on the AI analysis text, about page, and technical analysis dashboard, here is the reconstructed strategy:

### 4.1 Data Inputs

The AI system analyzes:
1. **Real-time DSE price data** — current price, high, low, open, close
2. **Trading volume** — today's volume vs. 30-day average volume
3. **Price trends** — short-term, medium-term, and long-term trend percentages
4. **Fundamental data** — sector performance, company information
5. **Market news and trends** — broader market context

### 4.2 Technical Analysis Methodology

| Indicator | How It's Used |
|-----------|--------------|
| **Trend Analysis** | Long trend (e.g., +26.64%), medium trend (e.g., +23.33%) — stocks with positive multi-timeframe trends are preferred |
| **Volume Analysis** | Compares today's volume to 30-day average — high relative volume signals institutional interest and is a positive factor |
| **RSI (14)** | Relative Strength Index — identifies overbought (>70), neutral (30-70), oversold (<30) conditions |
| **Support & Resistance** | Key price levels for entry/exit |
| **Price Position** | Where current price sits relative to recent range (high/mid/low) |
| **Momentum** | Bullish / Neutral / Bearish classification |
| **Liquidity Rating** | 1-5 star rating based on trading volume and value |

### 4.3 Signal Generation

The system produces signals on a spectrum:
- **Strong Buy** — high confidence, strong multi-factor alignment
- **Buy** — positive outlook with moderate confidence
- **Hold** — neutral/wait-and-watch
- **Sell / Strong Sell** — (likely available but not observed in today's picks)

Each signal comes with a **confidence score (%)** based on how many factors align.

### 4.4 Stock Selection Criteria for Daily Picks

From the analysis text patterns, the AI appears to prioritize:
1. **Positive multi-timeframe trends** — both medium and long trends must be positive
2. **Volume surge** — today's volume significantly above 30-day average (signals institutional buying)
3. **Upward momentum** — stocks showing acceleration, not just static performance
4. **Reasonable target upside** — picks tend to have 8-10% expected gain targets
5. **Confidence threshold** — only stocks with 75%+ confidence make the top 3

### 4.5 AI Model

- Uses **OpenAI GPT-4o** as the reasoning engine
- Takes structured market data as input
- Generates natural language analysis explaining the reasoning
- Produces structured output: signal, confidence, target price, reasoning text

---

## 5. Monetization & Pricing

| Plan | Price | Billing |
|------|-------|---------|
| Monthly | ৳299/month (~$2.70 USD) | Monthly recurring |
| Yearly | ~৳251/month (16% savings) | Annual billing |
| Free Trial | 7 days, no credit card required | One-time |

**Payment Methods:** Visa, Mastercard, Amex, DBBL Nexus, UnionPay, bKash, Nagad, Tap, Meghna Pay, Upay, CellFin — via **EPS Payment Gateway**.

**Coupon system** available (কুপন কোড).

### Premium Features (Gated):
- Full AI stock picks with signals, targets, confidence
- Technical analysis dashboard
- Stock search & tracking
- Portfolio tracker
- Daily email picks (7:30 AM)
- Weekly market insights email (Saturday 8 PM)

---

## 6. Technical Architecture Observations

- **Frontend:** React SPA (single-page application) — assets served as bundled JS (`index-BYtQ_PYk.js`)
- **Authentication:** Email/password + Google OAuth
- **API:** Fetches stock data and technical analysis via backend APIs (observed in console logs: "Fetching stock data for: GP", "Fetching technical analysis for: GP")
- **Stock Database:** 345 DSE stocks loaded on dashboard init
- **Notice System:** Server-driven notice/popup system with day-of-week targeting, holiday detection, weekend detection
- **UI Library:** Uses dialog components (likely Radix UI based on console warnings about DialogTitle/DialogContent)

---

## 7. Summary

StockLens BD is a focused, niche SaaS product serving Bangladeshi retail stock investors. Its core loop is simple and effective:

1. **AI analyzes DSE market data daily** using GPT-4o
2. **Picks top 3 stocks** based on trend, volume, momentum, and technical indicators
3. **Delivers via email and dashboard** before market open
4. **Users can also search any stock** for on-demand AI technical analysis
5. **Portfolio tracker** lets users manage and track positions

The prediction strategy combines **trend-following** (multi-timeframe positive trends), **volume confirmation** (above-average volume as institutional interest proxy), and **technical indicator analysis** (RSI, support/resistance, momentum) — all synthesized through GPT-4o to produce human-readable analysis with structured signals and confidence scores.
