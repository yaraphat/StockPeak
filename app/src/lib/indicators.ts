/**
 * Server-side technical indicator calculations.
 * All take arrays of closes (chronological, oldest first) and return the
 * latest value. Matches the Python broker_agent.py implementation so the
 * client gets consistent numbers regardless of which pipeline populated data.
 */

/** Relative Strength Index (Wilder) */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/** EMA — exponential moving average (most recent value) */
export function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return Math.round(e * 100) / 100;
}

/** MACD (12, 26, 9) — returns histogram + signal state */
export function macd(closes: number[]): { histogram: number; bullish: boolean } | null {
  if (closes.length < 35) return null;
  // Compute full EMA-12 and EMA-26 arrays
  const ema12 = emaArray(closes, 12);
  const ema26 = emaArray(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] != null && ema26[i] != null) {
      macdLine.push(ema12[i]! - ema26[i]!);
    }
  }
  const signalLine = emaArray(macdLine, 9);
  const lastIdx = macdLine.length - 1;
  if (lastIdx < 0 || signalLine[lastIdx] == null) return null;
  const histogram = macdLine[lastIdx] - signalLine[lastIdx]!;
  const prevHist = lastIdx > 0 && signalLine[lastIdx - 1] != null
    ? macdLine[lastIdx - 1] - signalLine[lastIdx - 1]!
    : 0;
  return {
    histogram: Math.round(histogram * 1000) / 1000,
    bullish: histogram > 0 && prevHist <= 0 ? true : histogram > 0,
  };
}

/** ATR (14) — average true range */
export function atr(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return Math.round(a * 100) / 100;
}

/** Volume ratio (today / N-day avg) */
export function volumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) return null;
  const recent = volumes.slice(-period - 1, -1);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (avg <= 0) return null;
  return Math.round((volumes[volumes.length - 1] / avg) * 100) / 100;
}

/** 52-week highs/lows. Filters out zero-OHLC rows (non-trading days or
 *  ingest artifacts) which would otherwise poison the min. */
export function weekRange(highs: number[], lows: number[], closes: number[]): { high: number; low: number; currentPct: number } {
  const n = Math.min(252, closes.length);
  const windowHighs = highs.slice(-n).filter((x) => x > 0);
  const windowLows = lows.slice(-n).filter((x) => x > 0);
  if (windowHighs.length === 0 || windowLows.length === 0) {
    return { high: 0, low: 0, currentPct: 50 };
  }
  const h = Math.max(...windowHighs);
  const l = Math.min(...windowLows);
  const cur = closes[closes.length - 1];
  const currentPct = h > l ? ((cur - l) / (h - l)) * 100 : 50;
  return {
    high: Math.round(h * 100) / 100,
    low: Math.round(l * 100) / 100,
    currentPct: Math.round(currentPct * 10) / 10,
  };
}

/** Classify overall signal from core indicators */
export type Signal = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

export function classifySignal(r: {
  rsi: number | null;
  macdBullish: boolean | null;
  volRatio: number | null;
  closeVsEma50: number | null; // (close - ema50) / ema50
  closeVsEma200: number | null;
}): { signal: Signal; score: number } {
  let score = 0;
  // Trend (50%)
  if (r.closeVsEma50 != null) score += r.closeVsEma50 > 0 ? 2 : -2;
  if (r.closeVsEma200 != null) score += r.closeVsEma200 > 0 ? 1 : -1;
  // Momentum (30%)
  if (r.rsi != null) {
    if (r.rsi > 70) score -= 1; // overbought
    else if (r.rsi < 30) score += 1; // oversold
    else if (r.rsi > 50) score += 1;
  }
  if (r.macdBullish === true) score += 1;
  else if (r.macdBullish === false) score -= 1;
  // Volume (20%)
  if (r.volRatio != null) {
    if (r.volRatio > 2) score += 2;
    else if (r.volRatio > 1.3) score += 1;
    else if (r.volRatio < 0.5) score -= 1;
  }

  let signal: Signal = "HOLD";
  if (score >= 5) signal = "STRONG BUY";
  else if (score >= 3) signal = "BUY";
  else if (score <= -5) signal = "STRONG SELL";
  else if (score <= -3) signal = "SELL";

  return { signal, score };
}

/** Identify recent support/resistance as recent swing highs/lows */
export function swingLevels(closes: number[], window = 5): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  const n = closes.length;
  for (let i = window; i < n - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (closes[i] <= closes[i - j] || closes[i] <= closes[i + j]) isHigh = false;
      if (closes[i] >= closes[i - j] || closes[i] >= closes[i + j]) isLow = false;
    }
    if (isHigh) resistances.push(closes[i]);
    if (isLow) supports.push(closes[i]);
  }
  // De-dupe nearby levels (within 1% of each other)
  const cur = closes[closes.length - 1];
  const near = (a: number, b: number) => Math.abs(a - b) / cur < 0.01;
  const dedupe = (xs: number[]) => {
    const sorted = xs.sort((a, b) => b - a);
    const out: number[] = [];
    for (const x of sorted) if (!out.some((y) => near(x, y))) out.push(x);
    return out;
  };
  return {
    supports: dedupe(supports.filter((s) => s < cur)).slice(0, 3).map((x) => Math.round(x * 100) / 100),
    resistances: dedupe(resistances.filter((r) => r > cur)).slice(0, 3).reverse().map((x) => Math.round(x * 100) / 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: EMA array (every index) — for MACD chains
// ─────────────────────────────────────────────────────────────────────────────
function emaArray(values: number[], period: number): (number | null)[] {
  if (values.length < period) return values.map(() => null);
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
