import { createServiceClient } from "./supabase";
import type { Pick, PickOutcome, Scorecard } from "./types";

export async function getTodaysPicks(): Promise<Pick[]> {
  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await db
    .from("picks")
    .select("*")
    .eq("date", today)
    .order("confidence", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPicksByDate(date: string): Promise<Pick[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("picks")
    .select("*")
    .eq("date", date)
    .order("confidence", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentPicks(limit = 30): Promise<Pick[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("picks")
    .select("*")
    .order("date", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getScorecard(): Promise<Scorecard> {
  const db = createServiceClient();
  const { data: outcomes, error } = await db
    .from("pick_outcomes")
    .select("outcome, gain_pct");

  if (error) throw error;
  if (!outcomes || outcomes.length === 0) {
    return {
      total_picks: 0,
      target_hits: 0,
      stop_hits: 0,
      open_picks: 0,
      hit_rate: 0,
      avg_gain: 0,
      avg_loss: 0,
    };
  }

  const total = outcomes.length;
  const hits = outcomes.filter((o) => o.outcome === "target_hit");
  const stops = outcomes.filter((o) => o.outcome === "stop_hit");
  const open = outcomes.filter((o) => o.outcome === "open");
  const closed = outcomes.filter((o) => o.outcome !== "open");

  const gains = hits.map((h) => h.gain_pct ?? 0);
  const losses = stops.map((s) => s.gain_pct ?? 0);

  return {
    total_picks: total,
    target_hits: hits.length,
    stop_hits: stops.length,
    open_picks: open.length,
    hit_rate: closed.length > 0 ? (hits.length / closed.length) * 100 : 0,
    avg_gain: gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / gains.length : 0,
    avg_loss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
  };
}

export async function getPickHistory(
  limit = 50
): Promise<(Pick & { outcome?: PickOutcome })[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("picks")
    .select("*, pick_outcomes(*)")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    outcome: p.pick_outcomes?.[0] ?? undefined,
  }));
}
