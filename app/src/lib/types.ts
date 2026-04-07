export interface Pick {
  id: string;
  date: string;
  ticker: string;
  company_name: string;
  company_name_bn: string;
  buy_zone: number;
  target: number;
  stop_loss: number;
  confidence: number;
  reasoning_bn: string;
  reasoning_en: string;
  market_mood: "bullish" | "neutral" | "bearish";
  market_mood_reason: string;
  created_at: string;
}

export interface PickOutcome {
  id: string;
  pick_id: string;
  outcome: "open" | "target_hit" | "stop_hit" | "expired";
  exit_price: number | null;
  exit_date: string | null;
  gain_pct: number | null;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "free" | "pro" | "admin";
  trial_ends_at: string | null;
  created_at: string;
}

export interface Scorecard {
  total_picks: number;
  target_hits: number;
  stop_hits: number;
  open_picks: number;
  hit_rate: number;
  avg_gain: number;
  avg_loss: number;
}
