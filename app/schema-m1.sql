-- Stock Peak M1 schema additions — 2026-04-15
-- Covers: schema migration tracking, stock master, payments, subscription extensions,
-- APScheduler jobstore, stale-pick metadata.
-- Idempotent by design. Safe to re-run.

-- ============================================================
-- Migration tracker (task #34) — replaces .stockpeak_initialized marker
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz DEFAULT now()
);

-- Seed entries for already-applied schemas so entrypoint doesn't re-run them
INSERT INTO schema_migrations (filename) VALUES
  ('01-schema.sql'),
  ('02-schema-portfolio.sql'),
  ('03-schema-broker-agent.sql'),
  ('04-schema-notifications.sql')
ON CONFLICT (filename) DO NOTHING;

-- ============================================================
-- DSE stock master (task #35)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS dse_stocks (
  ticker             text PRIMARY KEY,
  company_name       text NOT NULL,
  company_name_bn    text,
  category           text CHECK (category IN ('A','B','N','Z')),
  sector             text,
  is_active          boolean DEFAULT true,
  last_backfilled_at timestamptz DEFAULT NULL,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dse_stocks_ticker_trgm
  ON dse_stocks USING gin (ticker gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dse_stocks_name_trgm
  ON dse_stocks USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dse_stocks_active
  ON dse_stocks (is_active) WHERE is_active = true;

-- ============================================================
-- Pending payments (task #37) — bKash + Nagad SMS-verified flow
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_payments (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  provider        text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
  sender_phone    text NOT NULL,
  amount_expected numeric NOT NULL,
  tier            text NOT NULL DEFAULT 'entry' CHECK (tier IN ('entry','premium','pro','analyst','elite','expert')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'expired', 'manual_approved', 'rejected')),
  trxid           text DEFAULT NULL,
  sms_body        text DEFAULT NULL,
  matched_at      timestamptz DEFAULT NULL,
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_match
  ON pending_payments (provider, sender_phone, amount_expected, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_payments_user
  ON pending_payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_payments_expires
  ON pending_payments (expires_at) WHERE status = 'pending';

-- ============================================================
-- Unmatched SMS log (for admin manual reconciliation)
-- ============================================================

CREATE TABLE IF NOT EXISTS unmatched_sms (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender         text NOT NULL,
  body           text NOT NULL,
  received_at    timestamptz DEFAULT now(),
  parsed_amount  numeric,
  parsed_phone   text,
  parsed_trxid   text,
  resolved_by    uuid REFERENCES users(id),
  resolved_at    timestamptz,
  resolution     text  -- 'matched_manually', 'not_a_payment', 'duplicate', etc.
);

CREATE INDEX IF NOT EXISTS idx_unmatched_sms_unresolved
  ON unmatched_sms (received_at DESC) WHERE resolved_at IS NULL;

-- ============================================================
-- Subscriptions extensions (task #37 + #38)
-- ============================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider            text CHECK (provider IN ('bkash', 'nagad', 'manual')),
  ADD COLUMN IF NOT EXISTS trxid               text,
  ADD COLUMN IF NOT EXISTS pending_payment_id  uuid REFERENCES pending_payments(id),
  ADD COLUMN IF NOT EXISTS amount_paid         numeric;

-- ============================================================
-- Users extensions (task #38 — JWT session_version + paywall)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarded_at     timestamptz DEFAULT NULL;

-- ============================================================
-- APScheduler jobstore (task #43)
-- ============================================================
-- Created automatically by SQLAlchemyJobStore on first run; schema listed for reference only.
-- APScheduler will create:
--   apscheduler_jobs(id text PRIMARY KEY, next_run_time double precision, job_state bytea)

-- ============================================================
-- Helper: subscription status view (task #38 middleware read path)
-- ============================================================

CREATE OR REPLACE VIEW v_user_access AS
SELECT
  u.id AS user_id,
  u.email,
  u.session_version,
  u.trial_ends_at,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = u.id
        AND s.status = 'active'
        AND s.expires_at > now()
    ) THEN 'subscribed'
    WHEN u.trial_ends_at > now() THEN 'trial'
    WHEN u.trial_ends_at > now() - interval '3 days' THEN 'grace'
    ELSE 'expired'
  END AS access_status,
  (
    SELECT s.expires_at FROM subscriptions s
    WHERE s.user_id = u.id AND s.status = 'active'
    ORDER BY s.expires_at DESC LIMIT 1
  ) AS subscription_expires_at
FROM users u;
