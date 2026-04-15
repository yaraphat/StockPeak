import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";
import { requireTier } from "@/lib/access";
import { rsi, macd, volumeRatio, classifySignal, ema, type Signal } from "@/lib/indicators";

// M2 Analyst tier. Returns all DSE stocks scored with today's signal.
// Computed on-demand from `stock_data`; cached 10 min via HTTP header.
//
// Query params:
//   signal=STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL  (comma-separated for multi)
//   sort=score|rsi|volume|ticker  (default: score)
//   limit=N   (default 50, max 400)

const sortAllowed = new Set(["score", "rsi", "volume", "ticker", "change"]);

export async function GET(req: NextRequest) {
  const gate = await requireTier("analyst");
  if ("error" in gate) return gate.error;

  const sortParam = req.nextUrl.searchParams.get("sort") ?? "score";
  const sort = sortAllowed.has(sortParam) ? sortParam : "score";
  const limit = Math.min(Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "50")), 400);
  const signalFilter = (req.nextUrl.searchParams.get("signal") ?? "")
    .split(",").filter(Boolean).map((s) => s.replace(/_/g, " ").toUpperCase());
  const categoryFilter = req.nextUrl.searchParams.get("category");

  const sql = getDb();

  // Pull last 250 rows per ticker in one query for all active stocks.
  // Only stocks with at least 50 days of data get an indicator score.
  const data = await sql`
    WITH recent AS (
      SELECT sd.ticker, sd.date, sd.close, sd.high, sd.low, sd.volume,
             ROW_NUMBER() OVER (PARTITION BY sd.ticker ORDER BY sd.date DESC) AS rn
      FROM stock_data sd
      JOIN dse_stocks ds ON ds.ticker = sd.ticker
      WHERE ds.is_active = true
        ${categoryFilter ? sql`AND ds.category = ${categoryFilter}` : sql``}
    )
    SELECT ticker,
           ARRAY_AGG(close ORDER BY date ASC) AS closes,
           ARRAY_AGG(high ORDER BY date ASC) AS highs,
           ARRAY_AGG(low ORDER BY date ASC) AS lows,
           ARRAY_AGG(volume ORDER BY date ASC) AS volumes,
           MAX(date) AS as_of
    FROM recent
    WHERE rn <= 250
    GROUP BY ticker
    HAVING COUNT(*) >= 50
  `;

  // Join metadata
  const metaRows = await sql`
    SELECT ticker, company_name, company_name_bn, category, sector
    FROM dse_stocks WHERE is_active = true
  `;
  const metaMap = new Map<string, Record<string, unknown>>();
  for (const m of metaRows) metaMap.set(m.ticker as string, m as Record<string, unknown>);

  const results: Array<{
    ticker: string;
    company_name: string | null;
    category: string | null;
    sector: string | null;
    current_price: number;
    change_pct: number | null;
    signal: Signal;
    score: number;
    rsi_14: number | null;
    volume_ratio: number | null;
    macd_bullish: boolean | null;
    as_of: string;
  }> = [];

  for (const row of data) {
    const closes = (row.closes as number[]).map(Number);
    const highs = (row.highs as number[]).map(Number);
    const lows = (row.lows as number[]).map(Number);
    const volumes = (row.volumes as number[]).map(Number);
    if (closes.length < 50) continue;
    const cur = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const r14 = rsi(closes, 14);
    const m = macd(closes);
    const vr = volumeRatio(volumes, 20);
    const ema50 = ema(closes, 50);
    const ema200 = closes.length >= 200 ? ema(closes, 200) : null;
    const sig = classifySignal({
      rsi: r14,
      macdBullish: m?.bullish ?? null,
      volRatio: vr,
      closeVsEma50: ema50 != null ? (cur - ema50) / ema50 : null,
      closeVsEma200: ema200 != null ? (cur - ema200) / ema200 : null,
    });
    const meta = metaMap.get(row.ticker as string);
    results.push({
      ticker: row.ticker as string,
      company_name: (meta?.company_name as string) ?? null,
      category: (meta?.category as string) ?? null,
      sector: (meta?.sector as string) ?? null,
      current_price: cur,
      change_pct: prev > 0 ? Math.round(((cur - prev) / prev) * 10000) / 100 : null,
      signal: sig.signal,
      score: sig.score,
      rsi_14: r14,
      volume_ratio: vr,
      macd_bullish: m?.bullish ?? null,
      as_of: (row.as_of as Date).toString().slice(0, 10),
    });
  }

  // Filter
  let filtered = results;
  if (signalFilter.length > 0) {
    filtered = filtered.filter((r) => signalFilter.includes(r.signal));
  }

  // Sort
  const sortFns: Record<string, (a: typeof results[0], b: typeof results[0]) => number> = {
    score:  (a, b) => b.score - a.score,
    rsi:    (a, b) => (b.rsi_14 ?? 0) - (a.rsi_14 ?? 0),
    volume: (a, b) => (b.volume_ratio ?? 0) - (a.volume_ratio ?? 0),
    change: (a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0),
    ticker: (a, b) => a.ticker.localeCompare(b.ticker),
  };
  filtered.sort(sortFns[sort]);

  const asOfDate = results[0]?.as_of ?? null;

  return NextResponse.json(
    {
      total: results.length,
      filtered: filtered.length,
      as_of: asOfDate,
      rankings: filtered.slice(0, limit),
      counts_by_signal: countBySignal(results),
    },
    {
      headers: { "Cache-Control": "private, max-age=600" }, // 10 min client cache
    }
  );
}

function countBySignal(results: Array<{ signal: Signal }>): Record<Signal, number> {
  const counts: Record<string, number> = {
    "STRONG BUY": 0, "BUY": 0, "HOLD": 0, "SELL": 0, "STRONG SELL": 0,
  };
  for (const r of results) counts[r.signal] = (counts[r.signal] ?? 0) + 1;
  return counts as Record<Signal, number>;
}
