import { getDb } from "./postgres";
import type { Pick, PickOutcome, Scorecard } from "./types";

export async function getTodaysPicks(): Promise<Pick[]> {
  const sql = getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = await sql`
    SELECT * FROM picks WHERE date = ${today} ORDER BY confidence DESC
  `;
  return rows as unknown as Pick[];
}

export async function getPicksByDate(date: string): Promise<Pick[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM picks WHERE date = ${date} ORDER BY confidence DESC
  `;
  return rows as unknown as Pick[];
}

export async function getRecentPicks(limit = 30): Promise<Pick[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM picks ORDER BY date DESC, confidence DESC LIMIT ${limit}
  `;
  return rows as unknown as Pick[];
}

export async function getScorecard(): Promise<Scorecard> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      count(*)::int AS total_picks,
      count(*) FILTER (WHERE po.outcome = 'target_hit')::int AS target_hits,
      count(*) FILTER (WHERE po.outcome = 'stop_hit')::int AS stop_hits,
      count(*) FILTER (WHERE po.outcome = 'open')::int AS open_picks,
      CASE
        WHEN count(*) FILTER (WHERE po.outcome != 'open') > 0
        THEN round(count(*) FILTER (WHERE po.outcome = 'target_hit')::numeric
             / count(*) FILTER (WHERE po.outcome != 'open') * 100, 1)
        ELSE 0
      END AS hit_rate,
      coalesce(round(avg(po.gain_pct) FILTER (WHERE po.outcome = 'target_hit'), 1), 0) AS avg_gain,
      coalesce(round(avg(po.gain_pct) FILTER (WHERE po.outcome = 'stop_hit'), 1), 0) AS avg_loss
    FROM picks p
    LEFT JOIN pick_outcomes po ON p.id = po.pick_id
  `;

  if (rows.length === 0) {
    return { total_picks: 0, target_hits: 0, stop_hits: 0, open_picks: 0, hit_rate: 0, avg_gain: 0, avg_loss: 0 };
  }

  const r = rows[0];
  return {
    total_picks: Number(r.total_picks),
    target_hits: Number(r.target_hits),
    stop_hits: Number(r.stop_hits),
    open_picks: Number(r.open_picks),
    hit_rate: Number(r.hit_rate),
    avg_gain: Number(r.avg_gain),
    avg_loss: Number(r.avg_loss),
  };
}

export async function getPickHistory(
  limit = 50
): Promise<(Pick & { outcome?: PickOutcome })[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      p.*,
      po.id AS outcome_id,
      po.outcome,
      po.exit_price,
      po.exit_date,
      po.gain_pct,
      po.updated_at AS outcome_updated_at
    FROM picks p
    LEFT JOIN pick_outcomes po ON p.id = po.pick_id
    ORDER BY p.date DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    ticker: r.ticker,
    company_name: r.company_name,
    company_name_bn: r.company_name_bn,
    buy_zone: Number(r.buy_zone),
    target: Number(r.target),
    stop_loss: Number(r.stop_loss),
    confidence: r.confidence,
    reasoning_bn: r.reasoning_bn,
    reasoning_en: r.reasoning_en,
    market_mood: r.market_mood,
    market_mood_reason: r.market_mood_reason,
    created_at: r.created_at,
    outcome: r.outcome_id
      ? {
          id: r.outcome_id,
          pick_id: r.id,
          outcome: r.outcome,
          exit_price: r.exit_price ? Number(r.exit_price) : null,
          exit_date: r.exit_date,
          gain_pct: r.gain_pct ? Number(r.gain_pct) : null,
          updated_at: r.outcome_updated_at,
        }
      : undefined,
  }));
}
