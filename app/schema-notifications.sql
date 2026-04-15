-- Notifications schema — in-app notification system
-- Replaces Telegram channel broadcasts with DB-stored, browser-deliverable notifications.

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type          text NOT NULL,  -- 'exceptional_opportunity', 'intraday_opportunity', 'stop_loss_hit', etc.
  title         text NOT NULL,
  body          text NOT NULL,
  ticker        text DEFAULT NULL,
  data          jsonb DEFAULT '{}',
  severity      text NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  read_at       timestamptz DEFAULT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user        ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created     ON notifications(created_at DESC);
