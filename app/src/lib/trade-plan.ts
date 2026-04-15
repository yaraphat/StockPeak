/**
 * Trade plan generator — entry, targets, and multi-step trailing stop-loss ladder.
 *
 * Inputs: current price, ATR (14-day), and optionally user risk tier.
 * Outputs: entry zone, T1/T2 targets, initial stop, 3-step trailing ladder.
 *
 * Pure math, no LLM. Runs in <1ms. Same ticker → same plan (deterministic).
 *
 * Stop-loss ladder logic (modeled on professional broker practice, see the
 * BL Portfolio "SONA BLW" example the user shared):
 *   - Divide the path from entry to T2 into 3 trigger zones
 *   - At each trigger, raise the stop to lock in profit while keeping a ~1 ATR buffer
 *   - Initial stop: entry - (ATR × stopMultiplier) based on risk tier
 *   - Target distance: ATR × targetMultiplier
 */

export type RiskTier = "conservative" | "moderate" | "aggressive";

export interface RiskProfile {
  stopMultiplier: number;   // initial stop distance in ATR units
  targetMultiplier: number; // T2 distance in ATR units
  positionPct: number;      // max % of portfolio in a single trade
}

export const RISK_PROFILES: Record<RiskTier, RiskProfile> = {
  conservative: { stopMultiplier: 1.0, targetMultiplier: 2.0, positionPct: 0.05 },
  moderate:     { stopMultiplier: 1.5, targetMultiplier: 2.5, positionPct: 0.10 },
  aggressive:   { stopMultiplier: 2.0, targetMultiplier: 4.0, positionPct: 0.15 },
};

export interface StopLadderStep {
  /** Price level that triggers this stop move */
  trigger: number;
  /** New stop-loss price once trigger hit */
  stop: number;
  /** Label shown to user: "Breakeven", "Lock 1R", "Lock 2R", etc. */
  label: string;
}

export interface TradePlan {
  // Entry
  entryLow: number;
  entryHigh: number;
  entryMid: number;

  // Targets
  target1: number;
  target1Pct: number;   // % gain
  target2: number;
  target2Pct: number;

  // Stop-loss ladder
  initialStop: number;
  initialStopPct: number; // % loss
  ladder: StopLadderStep[];

  // Risk math
  riskPerShare: number;   // R value
  rewardPerShare: number; // R to T1
  riskReward: number;     // 1:X to T1
  atr: number;

  // Position sizing (per user's tier)
  portfolioPctSuggested: number;

  // Validity horizon
  timeframe: string; // "Swing (5-15 days)" etc
}

/**
 * Generate a complete trade plan from current price + ATR.
 */
export function generateTradePlan(
  currentPrice: number,
  atr: number,
  riskTier: RiskTier = "moderate",
  timeframe: "intraday" | "swing" | "position" = "swing"
): TradePlan {
  const profile = RISK_PROFILES[riskTier];

  // Entry zone: ±0.5 ATR around current price (wait for a small dip, not chase)
  const entryMid = currentPrice;
  const entryLow = round(currentPrice - 0.5 * atr);
  const entryHigh = round(currentPrice + 0.25 * atr); // skew slightly above to cover slippage

  // Targets: T2 is main (risk tier multiplier), T1 is halfway
  const target2Distance = atr * profile.targetMultiplier;
  const target2 = round(entryMid + target2Distance);
  const target1 = round(entryMid + target2Distance * 0.5);

  // Initial stop
  const initialStopDistance = atr * profile.stopMultiplier;
  const initialStop = round(entryMid - initialStopDistance);

  // R unit = risk per share at initial stop
  const R = entryMid - initialStop;

  // Stop-loss ladder — 3 steps up as price rises
  //   Step 1 trigger at entry + 1R, stop moves to breakeven
  //   Step 2 trigger at entry + 2R, stop locks 1R profit
  //   Step 3 trigger at entry + 3R, stop locks 2R profit
  // Each stop is 0.5R below its trigger — gives room to not get shaken out on noise.
  const ladder: StopLadderStep[] = [];
  const step1Trigger = round(entryMid + 1 * R);
  if (step1Trigger < target2) {
    ladder.push({
      trigger: step1Trigger,
      stop: round(entryMid),
      label: "Breakeven",
    });
  }
  const step2Trigger = round(entryMid + 2 * R);
  if (step2Trigger < target2) {
    ladder.push({
      trigger: step2Trigger,
      stop: round(entryMid + 0.5 * R),
      label: "Lock +0.5R",
    });
  }
  const step3Trigger = round(entryMid + 3 * R);
  if (step3Trigger < target2) {
    ladder.push({
      trigger: step3Trigger,
      stop: round(entryMid + 1.5 * R),
      label: "Lock +1.5R",
    });
  }

  // Risk math
  const rewardT1 = target1 - entryMid;
  const riskReward = rewardT1 > 0 && R > 0 ? rewardT1 / R : 0;

  return {
    entryLow,
    entryHigh,
    entryMid,
    target1,
    target1Pct: pct((target1 - entryMid) / entryMid),
    target2,
    target2Pct: pct((target2 - entryMid) / entryMid),
    initialStop,
    initialStopPct: pct((initialStop - entryMid) / entryMid),
    ladder,
    riskPerShare: round(R),
    rewardPerShare: round(rewardT1),
    riskReward: Math.round(riskReward * 10) / 10,
    atr: round(atr),
    portfolioPctSuggested: profile.positionPct,
    timeframe:
      timeframe === "intraday" ? "Intraday (same day)" :
      timeframe === "position" ? "Position (30-90+ days)" :
      "Swing (5-15 days)",
  };
}

/**
 * Position sizing for a user with a known portfolio value.
 * Uses the 1-2% risk rule: max risk per trade = risk_pct × portfolio_value.
 * Quantity = max_risk / R.
 */
export interface PositionSize {
  maxCapital: number;   // max BDT to allocate to this trade
  maxRisk: number;      // max BDT loss if stop hit
  quantity: number;     // shares to buy
  actualCapital: number; // quantity × entry
  actualRisk: number;   // quantity × R
}

export function computePositionSize(
  plan: TradePlan,
  portfolioValue: number,
  riskTier: RiskTier = "moderate"
): PositionSize {
  const profile = RISK_PROFILES[riskTier];
  const riskPct = riskTier === "aggressive" ? 0.02 : riskTier === "conservative" ? 0.005 : 0.01;

  const maxRisk = portfolioValue * riskPct;
  const maxCapital = portfolioValue * profile.positionPct;

  // Choose the binding constraint
  const qtyByRisk = plan.riskPerShare > 0 ? Math.floor(maxRisk / plan.riskPerShare) : 0;
  const qtyByCapital = plan.entryMid > 0 ? Math.floor(maxCapital / plan.entryMid) : 0;
  const quantity = Math.max(0, Math.min(qtyByRisk, qtyByCapital));

  return {
    maxCapital: round(maxCapital),
    maxRisk: round(maxRisk),
    quantity,
    actualCapital: round(quantity * plan.entryMid),
    actualRisk: round(quantity * plan.riskPerShare),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(ratio: number): number {
  return Math.round(ratio * 10000) / 100;
}
