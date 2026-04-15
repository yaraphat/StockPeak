import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";
import { requireTier } from "@/lib/access";
import { rsi, macd, atr, volumeRatio, weekRange, classifySignal, ema, swingLevels } from "@/lib/indicators";
import { generateTradePlan, computePositionSize, type RiskTier } from "@/lib/trade-plan";

// M2 Analyst-tier endpoint. Returns full AI read + trade plan for any DSE ticker.
// Uses cached per_stock_analysis if fresh (< 12h), otherwise computes on-demand.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const gate = await requireTier("analyst");
  if ("error" in gate) return gate.error;
  const { userId, access } = gate;

  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  const sql = getDb();

  // Load user's risk tier (for position sizing)
  const [user] = await sql`SELECT risk_tier FROM users WHERE id = ${userId}`;
  const riskTier = ((user?.risk_tier as string) ?? "moderate") as RiskTier;

  // Load stock meta
  const [meta] = await sql`
    SELECT ticker, company_name, company_name_bn, category, sector
    FROM dse_stocks WHERE ticker = ${ticker}
  `;
  if (!meta) return NextResponse.json({ error: "Stock not found" }, { status: 404 });

  // Load last ~300 trading days for indicators
  const rows = await sql`
    SELECT date::text, open, high, low, close, volume
    FROM stock_data
    WHERE ticker = ${ticker}
    ORDER BY date ASC
  `;

  if (rows.length < 50) {
    return NextResponse.json({
      meta,
      error: "insufficient_data",
      message: "Not enough historical data yet. Charts populate daily; check back after the next market close.",
      rows_available: rows.length,
    });
  }

  const closes = rows.map((r: Record<string, unknown>) => Number(r.close));
  const highs = rows.map((r: Record<string, unknown>) => Number(r.high));
  const lows = rows.map((r: Record<string, unknown>) => Number(r.low));
  const volumes = rows.map((r: Record<string, unknown>) => Number(r.volume));
  const currentPrice = closes[closes.length - 1];
  const asOfDate = rows[rows.length - 1].date;

  // Indicators
  const r14 = rsi(closes, 14);
  const r7 = rsi(closes, 7);
  const m = macd(closes);
  const a = atr(highs, lows, closes, 14);
  const vr = volumeRatio(volumes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = closes.length >= 200 ? ema(closes, 200) : null;
  const rng = weekRange(highs, lows, closes);
  const levels = swingLevels(closes.slice(-180));

  // Signal
  const sig = classifySignal({
    rsi: r14,
    macdBullish: m?.bullish ?? null,
    volRatio: vr,
    closeVsEma50: ema50 != null ? (currentPrice - ema50) / ema50 : null,
    closeVsEma200: ema200 != null ? (currentPrice - ema200) / ema200 : null,
  });

  // Trade plan
  const plan = a != null ? generateTradePlan(currentPrice, a, riskTier) : null;

  // AI read (deterministic bullets from indicators — no LLM call for speed)
  const aiRead: string[] = [];
  if (r14 != null) {
    if (r14 > 70) aiRead.push(`RSI ${r14.toFixed(0)} — overbought, wait for cooldown`);
    else if (r14 < 30) aiRead.push(`RSI ${r14.toFixed(0)} — oversold, potential bounce setup`);
    else if (r14 > 50) aiRead.push(`RSI ${r14.toFixed(0)} — bullish momentum, not overheated`);
    else aiRead.push(`RSI ${r14.toFixed(0)} — below 50, wait for momentum shift`);
  }
  if (m != null) {
    aiRead.push(
      m.bullish
        ? `MACD bullish — histogram positive`
        : `MACD bearish — histogram negative, wait for crossover`
    );
  }
  if (vr != null) {
    if (vr > 2) aiRead.push(`Volume ${vr.toFixed(1)}× average — strong institutional interest`);
    else if (vr > 1.3) aiRead.push(`Volume ${vr.toFixed(1)}× average — above normal`);
    else if (vr < 0.5) aiRead.push(`Volume ${vr.toFixed(1)}× average — thin, low conviction`);
  }
  if (ema50 != null && ema200 != null) {
    if (currentPrice > ema50 && currentPrice > ema200)
      aiRead.push(`Price above both EMA 50 and 200 — uptrend intact`);
    else if (currentPrice < ema50 && currentPrice < ema200)
      aiRead.push(`Price below both EMA 50 and 200 — downtrend`);
    else
      aiRead.push(`Mixed trend — price between EMA 50 and 200`);
  }

  // Red flags
  const redFlags: string[] = [];
  if (meta.category === "Z") {
    redFlags.push("Z-category — AGM/dividend default, T+9 settlement. High manipulation risk.");
  }
  const avgTurnover = closes.slice(-20).reduce((a, c, i) => a + c * volumes[volumes.length - 20 + i], 0) / 20;
  if (avgTurnover < 500_000) {
    redFlags.push(`Low liquidity — avg turnover ৳${Math.round(avgTurnover / 100000)} lakh/day. Slippage likely on larger orders.`);
  }
  if (vr != null && vr > 5) {
    redFlags.push(`Volume spike ${vr.toFixed(1)}× normal — investigate for news or pump activity before acting.`);
  }

  // Position sizing — uses user's portfolio value if they have one, else ৳100,000 sample
  const [portfolioTotal] = await sql`
    SELECT COALESCE(SUM(quantity * buy_price), 0)::numeric AS total
    FROM portfolio_holdings WHERE user_id = ${userId}
  `;
  const portfolioValue = Math.max(100_000, Number(portfolioTotal?.total ?? 0));
  const sizing = plan ? computePositionSize(plan, portfolioValue, riskTier) : null;

  return NextResponse.json({
    meta,
    current_price: currentPrice,
    as_of: asOfDate,
    signal: sig.signal,
    score: sig.score,
    risk_tier: riskTier,
    indicators: {
      rsi_14: r14,
      rsi_7: r7,
      macd_histogram: m?.histogram ?? null,
      macd_bullish: m?.bullish ?? null,
      atr_14: a,
      volume_ratio: vr,
      ema_50: ema50,
      ema_200: ema200,
      week_range: rng,
    },
    levels,
    trade_plan: plan,
    position_sizing: sizing,
    ai_read: aiRead,
    red_flags: redFlags,
  });
}
