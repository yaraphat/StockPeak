-- Stock Peak Database Schema
-- Run against your PostgreSQL instance: psql -U your_user -d stockpeak -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text,
  name text,
  phone text,
  google_id text UNIQUE,
  role text NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'pro', 'admin')),
  trial_ends_at timestamptz DEFAULT (now() + interval '7 days'),
  telegram_chat_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- Subscriptions
CREATE TABLE subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'annual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  payment_provider text,
  payment_id text,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- Stock data (EOD OHLCV)
CREATE TABLE stock_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  ticker text NOT NULL,
  open numeric,
  high numeric,
  low numeric,
  close numeric NOT NULL,
  volume bigint,
  change_pct numeric,
  UNIQUE(date, ticker)
);

CREATE INDEX idx_stock_data_date ON stock_data(date);
CREATE INDEX idx_stock_data_ticker ON stock_data(ticker);

-- Daily picks
CREATE TABLE picks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  ticker text NOT NULL,
  company_name text NOT NULL,
  company_name_bn text NOT NULL,
  buy_zone numeric NOT NULL,
  target numeric NOT NULL,
  stop_loss numeric NOT NULL,
  confidence integer NOT NULL CHECK (confidence BETWEEN 1 AND 10),
  reasoning_bn text,
  reasoning_en text,
  market_mood text CHECK (market_mood IN ('bullish', 'neutral', 'bearish')),
  market_mood_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_picks_date ON picks(date);

-- Pick outcomes (auto-tracked)
CREATE TABLE pick_outcomes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_id uuid REFERENCES picks(id) ON DELETE CASCADE NOT NULL UNIQUE,
  outcome text NOT NULL DEFAULT 'open' CHECK (outcome IN ('open', 'target_hit', 'stop_hit', 'expired')),
  exit_price numeric,
  exit_date date,
  gain_pct numeric,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pick_outcomes_outcome ON pick_outcomes(outcome);

-- Alerts sent (dedup tracking)
CREATE TABLE alerts_sent (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pick_id uuid REFERENCES picks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'telegram')),
  alert_type text NOT NULL CHECK (alert_type IN ('daily', 'exit', 'weekly')),
  sent_at timestamptz DEFAULT now(),
  UNIQUE(pick_id, user_id, alert_type)
);

-- Scorecard view
CREATE OR REPLACE VIEW scorecard_view AS
SELECT
  count(*) AS total_picks,
  count(*) FILTER (WHERE po.outcome = 'target_hit') AS target_hits,
  count(*) FILTER (WHERE po.outcome = 'stop_hit') AS stop_hits,
  count(*) FILTER (WHERE po.outcome = 'open') AS open_picks,
  CASE
    WHEN count(*) FILTER (WHERE po.outcome != 'open') > 0
    THEN round(count(*) FILTER (WHERE po.outcome = 'target_hit')::numeric
         / count(*) FILTER (WHERE po.outcome != 'open') * 100, 1)
    ELSE 0
  END AS hit_rate,
  coalesce(round(avg(po.gain_pct) FILTER (WHERE po.outcome = 'target_hit'), 1), 0) AS avg_gain,
  coalesce(round(avg(po.gain_pct) FILTER (WHERE po.outcome = 'stop_hit'), 1), 0) AS avg_loss
FROM picks p
LEFT JOIN pick_outcomes po ON p.id = po.pick_id;
