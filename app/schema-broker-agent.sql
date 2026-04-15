-- Broker Agent Migration — Phase 1-3 schema additions
-- Run: psql -U postgres -p 6051 -d stockpeak -f schema-broker-agent.sql

-- ============================================================
-- picks table: add risk_annotations + idempotency constraint
-- ============================================================

ALTER TABLE picks
  ADD COLUMN IF NOT EXISTS risk_annotations JSONB DEFAULT '{}';

-- Unique constraint required for ON CONFLICT (date, ticker) DO NOTHING
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'picks_date_ticker_key' AND conrelid = 'picks'::regclass
  ) THEN
    ALTER TABLE picks ADD CONSTRAINT picks_date_ticker_key UNIQUE (date, ticker);
  END IF;
END $$;


-- ============================================================
-- users table: risk profiling (Phase 1)
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS risk_tier text NOT NULL DEFAULT 'moderate'
    CHECK (risk_tier IN ('conservative', 'moderate', 'aggressive')),
  ADD COLUMN IF NOT EXISTS risk_answers JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS risk_profile_set_at timestamptz DEFAULT NULL;

-- Existing users keep 'moderate' default (silent migration, no disruption)


-- ============================================================
-- portfolio_snapshots: pre-computed daily VaR cache (Phase 3)
-- ============================================================

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_value numeric,
  daily_pnl numeric,
  var_95_pct numeric,          -- VaR as % of portfolio (95% confidence, historical)
  var_95_amount numeric,       -- VaR in BDT
  max_drawdown_pct numeric,    -- drawdown from portfolio peak
  peak_value numeric,          -- portfolio peak value for drawdown calc
  correlation_matrix JSONB,    -- {ticker: {ticker: correlation_coefficient}}
  holdings_snapshot JSONB,     -- snapshot of holdings at computation time
  computed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date);


-- ============================================================
-- alerts_log: all advisory alerts sent to users (Phase 2-3)
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN (
    'stop_loss_hit', 'approaching_stop', 'target_hit',
    'drawdown_10', 'drawdown_15', 'drawdown_20',
    'high_correlation', 'volume_spike', 'price_move_5pct', 'price_move_10pct',
    'circuit_breaker', 'exceptional_opportunity',
    'pre_market_brief', 'eod_summary', 'weekly_digest'
  )),
  ticker text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  message text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('telegram', 'email', 'both')),
  delivered_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_log_user ON alerts_log(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_type ON alerts_log(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_log_delivered ON alerts_log(delivered_at);

-- Retained for 1 year (purge via scheduled job)


-- ============================================================
-- notification_log: scheduled notification delivery log (Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type text NOT NULL CHECK (notification_type IN (
    'pre_market_brief', 'intraday_monitor', 'intraday_opportunity_scan', 'eod_summary', 'weekly_digest'
  )),
  scheduled_for timestamptz NOT NULL,
  delivered_at timestamptz DEFAULT NULL,
  skipped_reason text DEFAULT NULL,   -- e.g. 'stale_data', 'market_holiday', 'no_subscribers'
  recipient_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_scheduled ON notification_log(scheduled_for);

-- Purged after 90 days


-- ============================================================
-- notification_schedule: APScheduler state persistence (Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL UNIQUE,
  last_run_at timestamptz DEFAULT NULL,
  last_status text DEFAULT NULL CHECK (last_status IN ('success', 'skipped', 'error')),
  updated_at timestamptz DEFAULT now()
);

-- Seed known jobs
INSERT INTO notification_schedule (job_name) VALUES
  ('pre_market_brief'),
  ('intraday_monitor'),
  ('intraday_opportunity_scan'),
  ('eod_summary'),
  ('weekly_digest')
ON CONFLICT (job_name) DO NOTHING;


-- ============================================================
-- dse_daily_snapshots: full broker_agent report per trading day
-- Real DSE data + computed indicators, retained for historical analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS dse_daily_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  market_summary JSONB NOT NULL,    -- {mood, advancing, declining, total_volume, ...}
  stocks JSONB NOT NULL,            -- full per-stock indicators + risk_annotations
  stock_count integer NOT NULL,
  source text NOT NULL DEFAULT 'broker_agent',
  captured_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dse_snapshots_date ON dse_daily_snapshots(snapshot_date DESC);


-- ============================================================
-- feedback_reports: compiled performance stats per analysis run
-- Structured stats only — no raw market data, no scraped text.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date date NOT NULL,
  period text NOT NULL,               -- 'last_30_picks', 'last_60_picks', etc.
  total_resolved int NOT NULL,
  win_rate numeric,
  avg_gain_pct numeric,
  confidence_calibration JSONB,       -- {"8-10": 0.55, "5-7": 0.62, "1-4": 0.40}
  indicator_patterns JSONB,           -- [{condition, sample, win_rate}, ...]
  mood_performance JSONB,             -- {bullish: {picks, win_rate}, bearish: {...}}
  ticker_performance JSONB,           -- {TICKER: {picks, wins, losses, avg_gain}}
  worst_patterns JSONB,               -- top 3 worst-performing patterns
  raw_stats JSONB,                    -- full stats blob for audit
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_date ON feedback_reports(report_date DESC);


-- ============================================================
-- skill_proposals: human-gated prompt change proposals
-- Engine drafts, admin approves. Engine NEVER writes skill files.
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_name text NOT NULL,
  proposal_type text NOT NULL CHECK (proposal_type IN (
    'prompt_adjustment', 'threshold_change', 'new_rule', 'remove_rule'
  )),
  evidence_summary text NOT NULL,     -- structured stats that triggered this
  current_text text NOT NULL,         -- exact lines being changed
  proposed_text text NOT NULL,        -- replacement text
  reasoning text NOT NULL,            -- why, in plain language
  sample_size int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'deferred'
  )),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_note text,
  applied_commit text,                -- git commit hash after approval
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_proposals_status ON skill_proposals(status);
CREATE INDEX IF NOT EXISTS idx_skill_proposals_created ON skill_proposals(created_at DESC);


-- ============================================================
-- Migrations: widen CHECK constraints for new notification types
-- Safe to run on existing DBs — drops old constraint, adds new one.
-- ============================================================

DO $$
BEGIN
  -- notification_log: add intraday_opportunity_scan type
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_log_notification_type_check'
      AND conrelid = 'notification_log'::regclass
  ) THEN
    ALTER TABLE notification_log DROP CONSTRAINT notification_log_notification_type_check;
  END IF;

  ALTER TABLE notification_log
    ADD CONSTRAINT notification_log_notification_type_check
    CHECK (notification_type IN (
      'pre_market_brief', 'intraday_monitor', 'intraday_opportunity_scan',
      'eod_summary', 'weekly_digest'
    ));

  -- alerts_log: add exceptional_opportunity type
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alerts_log_alert_type_check'
      AND conrelid = 'alerts_log'::regclass
  ) THEN
    ALTER TABLE alerts_log DROP CONSTRAINT alerts_log_alert_type_check;
  END IF;

  ALTER TABLE alerts_log
    ADD CONSTRAINT alerts_log_alert_type_check
    CHECK (alert_type IN (
      'stop_loss_hit', 'approaching_stop', 'target_hit',
      'drawdown_10', 'drawdown_15', 'drawdown_20',
      'high_correlation', 'volume_spike', 'price_move_5pct', 'price_move_10pct',
      'circuit_breaker', 'exceptional_opportunity',
      'pre_market_brief', 'eod_summary', 'weekly_digest'
    ));

  -- seed new job into notification_schedule
  INSERT INTO notification_schedule (job_name)
  VALUES ('intraday_opportunity_scan')
  ON CONFLICT (job_name) DO NOTHING;

EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Migration warning: %', SQLERRM;
END $$;
