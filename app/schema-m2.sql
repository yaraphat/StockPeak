-- Stock Peak M2 Analyst tier — 2026-04-15
-- Extends subscriptions with explicit tier tracking.
-- Previous schema had `plan text` (free/pro/annual) and `pending_payments.tier`.
-- This consolidates to a single source of truth.

-- ============================================================
-- Tier catalog (append-only reference)
-- ============================================================

CREATE TABLE IF NOT EXISTS tier_catalog (
  tier        text PRIMARY KEY,
  display_en  text NOT NULL,
  display_bn  text NOT NULL,
  price_bdt   numeric NOT NULL,
  rank        int NOT NULL,  -- higher rank = more features
  features    jsonb NOT NULL DEFAULT '[]'
);

INSERT INTO tier_catalog (tier, display_en, display_bn, price_bdt, rank, features) VALUES
  ('entry',    'Entry',    'এন্ট্রি',    260,  1,
    '["3 daily picks", "Portfolio P&L", "Stock search + charts", "Browser notifications", "Track record"]'),
  ('analyst',  'Analyst',  'অ্যানালিস্ট', 550,  2,
    '["Everything in Entry", "Full DSE rankings (400+ stocks)", "Per-stock AI analysis", "Trade plan with stop-loss ladder", "Position sizing by risk tier", "Event warnings"]')
ON CONFLICT (tier) DO UPDATE SET
  display_en = EXCLUDED.display_en,
  display_bn = EXCLUDED.display_bn,
  price_bdt  = EXCLUDED.price_bdt,
  rank       = EXCLUDED.rank,
  features   = EXCLUDED.features;

-- Subscriptions: add explicit tier column (nullable for existing rows; derived from plan)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS tier text REFERENCES tier_catalog(tier);

-- Backfill existing active subscriptions to 'entry' tier
UPDATE subscriptions
SET tier = 'entry'
WHERE tier IS NULL AND plan IN ('pro', 'annual');

-- ============================================================
-- Updated v_user_access — now surfaces tier + rank
-- ============================================================

DROP VIEW IF EXISTS v_user_access CASCADE;

CREATE VIEW v_user_access AS
SELECT
  u.id AS user_id,
  u.email,
  u.session_version,
  u.trial_ends_at,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = u.id AND s.status = 'active' AND s.expires_at > now()
    ) THEN 'subscribed'
    WHEN u.trial_ends_at > now() THEN 'trial'
    WHEN u.trial_ends_at > now() - interval '3 days' THEN 'grace'
    ELSE 'expired'
  END AS access_status,
  (
    SELECT s.expires_at FROM subscriptions s
    WHERE s.user_id = u.id AND s.status = 'active'
    ORDER BY s.expires_at DESC LIMIT 1
  ) AS subscription_expires_at,
  -- Current tier. Trial users get 'entry' for UI purposes; paying users get their actual tier.
  COALESCE(
    (SELECT s.tier FROM subscriptions s
      WHERE s.user_id = u.id AND s.status = 'active' AND s.expires_at > now()
      ORDER BY s.expires_at DESC LIMIT 1),
    CASE WHEN u.trial_ends_at > now() THEN 'entry' ELSE NULL END
  ) AS current_tier,
  COALESCE(
    (SELECT tc.rank FROM subscriptions s
      JOIN tier_catalog tc ON tc.tier = s.tier
      WHERE s.user_id = u.id AND s.status = 'active' AND s.expires_at > now()
      ORDER BY s.expires_at DESC LIMIT 1),
    CASE WHEN u.trial_ends_at > now() THEN 1 ELSE 0 END
  ) AS tier_rank
FROM users u;

-- ============================================================
-- per_stock_analysis cache — computed once per day per ticker
-- ============================================================

CREATE TABLE IF NOT EXISTS per_stock_analysis (
  ticker          text NOT NULL,
  analysis_date   date NOT NULL DEFAULT CURRENT_DATE,
  signal          text CHECK (signal IN ('STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL')),
  score           int,
  confidence      int,
  entry_low       numeric,
  entry_high      numeric,
  target_1        numeric,
  target_2        numeric,
  initial_stop    numeric,
  -- stop_ladder: [{"trigger": 115.0, "stop": 112.0}, ...]
  stop_ladder     jsonb DEFAULT '[]',
  risk_reward     numeric,
  rsi_14          numeric,
  macd_histogram  numeric,
  volume_ratio    numeric,
  atr_14          numeric,
  support_levels  jsonb DEFAULT '[]',
  resistance_levels jsonb DEFAULT '[]',
  ai_read         text,       -- short AI-generated bullet-style read
  red_flags       jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (ticker, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_psa_signal ON per_stock_analysis (analysis_date DESC, signal);
CREATE INDEX IF NOT EXISTS idx_psa_score ON per_stock_analysis (analysis_date DESC, score DESC);
