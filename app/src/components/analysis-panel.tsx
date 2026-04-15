"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StopStep {
  trigger: number;
  stop: number;
  label: string;
}

interface Analysis {
  meta: { ticker: string; company_name: string | null; category: string | null };
  current_price: number;
  as_of: string;
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  score: number;
  risk_tier: "conservative" | "moderate" | "aggressive";
  indicators: {
    rsi_14: number | null;
    rsi_7: number | null;
    macd_histogram: number | null;
    macd_bullish: boolean | null;
    atr_14: number | null;
    volume_ratio: number | null;
    ema_50: number | null;
    ema_200: number | null;
    week_range: { high: number; low: number; currentPct: number };
  };
  levels: { supports: number[]; resistances: number[] };
  trade_plan: {
    entryLow: number;
    entryHigh: number;
    entryMid: number;
    target1: number;
    target1Pct: number;
    target2: number;
    target2Pct: number;
    initialStop: number;
    initialStopPct: number;
    ladder: StopStep[];
    riskPerShare: number;
    rewardPerShare: number;
    riskReward: number;
    atr: number;
    portfolioPctSuggested: number;
    timeframe: string;
  } | null;
  position_sizing: {
    maxCapital: number;
    maxRisk: number;
    quantity: number;
    actualCapital: number;
    actualRisk: number;
  } | null;
  ai_read: string[];
  red_flags: string[];
}

const SIGNAL_STYLE: Record<string, { bg: string; fg: string }> = {
  "STRONG BUY":  { bg: "rgba(22,163,74,0.15)",  fg: "#15803D" },
  "BUY":         { bg: "rgba(22,163,74,0.08)",  fg: "#16A34A" },
  "HOLD":        { bg: "rgba(120,113,108,0.1)", fg: "#78716C" },
  "SELL":        { bg: "rgba(220,38,38,0.08)",  fg: "#DC2626" },
  "STRONG SELL": { bg: "rgba(220,38,38,0.15)",  fg: "#991B1B" },
};

export function AnalysisPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState<{ current_tier?: string; required_tier?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stocks/${ticker}/analysis`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 402) {
          const body = await r.json().catch(() => ({}));
          setGated({ current_tier: body.current_tier, required_tier: body.required_tier });
          return;
        }
        if (r.status === 401) {
          setGated({});
          return;
        }
        if (!r.ok) {
          setError("Failed to load analysis");
          return;
        }
        const body = await r.json();
        if (body.error) setError(body.message ?? body.error);
        else setData(body);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-sm text-[var(--color-muted)]">
        Loading AI analysis...
      </div>
    );
  }

  if (gated) return <AnalystUpsell ticker={ticker} />;

  if (error) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-sm text-[var(--color-muted)]">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const sig = SIGNAL_STYLE[data.signal] ?? SIGNAL_STYLE.HOLD;
  const plan = data.trade_plan;

  return (
    <div className="space-y-4">
      {/* Signal + AI Read */}
      <div className="bg-white rounded-2xl overflow-hidden"
           style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)" }}>
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${sig.fg}, transparent)`, opacity: 0.7 }} />
        <div className="p-6">
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ background: sig.bg, color: sig.fg }}>
              {data.signal}
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: data.score > 0 ? "#16A34A" : data.score < 0 ? "#DC2626" : "#78716C" }}>
              Score {data.score > 0 ? "+" : ""}{data.score}
            </span>
            <span className="text-xs text-[var(--color-muted)]">·</span>
            <span className="text-xs text-[var(--color-muted)]">
              {plan?.timeframe ?? "Swing"}
            </span>
            <span className="text-xs text-[var(--color-muted)]">·</span>
            <span className="text-xs text-[var(--color-muted)] capitalize">
              Your risk tier: {data.risk_tier}
            </span>
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">AI Read</h3>
          <ul className="space-y-1.5">
            {data.ai_read.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[var(--color-primary)] mt-0.5 flex-shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trade Plan */}
      {plan && (
        <div className="bg-white rounded-2xl overflow-hidden"
             style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)" }}>
          <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Trade Plan</h3>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5">Generated from technical indicators · ATR-based</p>
            </div>
            <span className="text-xs font-mono text-[var(--color-muted)]">
              R/R {plan.riskReward.toFixed(1)}:1
            </span>
          </div>

          {/* Entry + Targets + Stop grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--background)] rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1">Entry zone</div>
              <div className="font-mono text-lg font-semibold tabular-nums">
                ৳{plan.entryLow.toFixed(2)} – ৳{plan.entryHigh.toFixed(2)}
              </div>
              <div className="text-[10px] text-[var(--color-muted)] mt-1">
                Current: ৳{data.current_price.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(22,163,74,0.05)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#16A34A" }}>Targets</div>
              <div className="font-mono text-sm tabular-nums">
                T1: ৳{plan.target1.toFixed(2)} <span className="text-[10px] text-[var(--color-muted)]">(+{plan.target1Pct.toFixed(1)}%)</span>
              </div>
              <div className="font-mono text-sm tabular-nums mt-0.5">
                T2: ৳{plan.target2.toFixed(2)} <span className="text-[10px] text-[var(--color-muted)]">(+{plan.target2Pct.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(220,38,38,0.05)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#DC2626" }}>Initial stop</div>
              <div className="font-mono text-lg font-semibold tabular-nums">৳{plan.initialStop.toFixed(2)}</div>
              <div className="text-[10px] mt-1" style={{ color: "#DC2626" }}>
                Risk ৳{plan.riskPerShare.toFixed(2)}/share ({plan.initialStopPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Stop-loss ladder */}
          {plan.ladder.length > 0 && (
            <div className="mx-6 mb-6 rounded-xl overflow-hidden"
                 style={{ border: "1px solid rgba(0,102,204,0.15)", background: "linear-gradient(135deg, rgba(0,102,204,0.02) 0%, rgba(255,255,255,0.5) 100%)" }}>
              <div className="px-4 py-2.5 border-b border-[rgba(0,102,204,0.1)] flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0066CC" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  Stop-loss ladder — trail as price rises
                </span>
              </div>
              <div className="divide-y divide-[rgba(0,102,204,0.08)]">
                {plan.ladder.map((step, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                           style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)" }}>
                        {i + 1}
                      </div>
                      <div className="text-sm">
                        When price reaches <span className="font-mono font-semibold tabular-nums">৳{step.trigger.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-[var(--color-muted)]">raise stop to</span>
                      <span className="font-mono font-semibold tabular-nums text-sm text-[var(--color-primary)]">
                        ৳{step.stop.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-[rgba(0,102,204,0.15)] text-[var(--color-primary)]">
                        {step.label}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 flex items-center justify-between gap-4"
                     style={{ background: "rgba(22,163,74,0.05)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                         style={{ background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)" }}>
                      ✓
                    </div>
                    <div className="text-sm font-medium">Final target</div>
                  </div>
                  <span className="font-mono font-semibold tabular-nums text-sm" style={{ color: "#16A34A" }}>
                    ৳{plan.target2.toFixed(2)}  (+{plan.target2Pct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Position sizing */}
          {data.position_sizing && data.position_sizing.quantity > 0 && (
            <div className="mx-6 mb-6 rounded-xl p-4"
                 style={{ background: "rgba(120,113,108,0.04)", border: "1px solid rgba(0,0,0,0.04)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                Position sizing ({data.risk_tier} tier)
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[10px] text-[var(--color-muted)]">Quantity</div>
                  <div className="font-mono font-semibold tabular-nums">{data.position_sizing.quantity}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--color-muted)]">Capital</div>
                  <div className="font-mono font-semibold tabular-nums">৳{data.position_sizing.actualCapital.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--color-muted)]">Max risk at stop</div>
                  <div className="font-mono font-semibold tabular-nums" style={{ color: "#DC2626" }}>
                    ৳{data.position_sizing.actualRisk.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Levels + Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5"
             style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">Support & Resistance</h3>
          <div className="space-y-2">
            {data.levels.resistances.map((r, i) => (
              <div key={`r${i}`} className="flex justify-between text-sm">
                <span className="text-xs text-[var(--color-muted)]">Resistance {i + 1}</span>
                <span className="font-mono font-semibold tabular-nums" style={{ color: "#DC2626" }}>৳{r.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-y border-[var(--color-border-subtle)] py-2 my-2">
              <span className="text-xs font-semibold">Current</span>
              <span className="font-mono font-semibold tabular-nums">৳{data.current_price.toFixed(2)}</span>
            </div>
            {data.levels.supports.map((s, i) => (
              <div key={`s${i}`} className="flex justify-between text-sm">
                <span className="text-xs text-[var(--color-muted)]">Support {i + 1}</span>
                <span className="font-mono font-semibold tabular-nums" style={{ color: "#16A34A" }}>৳{s.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {/* 52W bar */}
          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
            <div className="flex justify-between text-[10px] text-[var(--color-muted)] mb-1">
              <span>52W Low ৳{data.indicators.week_range.low.toFixed(2)}</span>
              <span>52W High ৳{data.indicators.week_range.high.toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-border)] rounded-full relative overflow-hidden">
              <div
                className="absolute top-0 h-full w-0.5 bg-[var(--color-primary)]"
                style={{ left: `${data.indicators.week_range.currentPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5"
             style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">Indicators</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {data.indicators.rsi_14 != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">RSI (14)</div>
                <div className="font-mono font-semibold tabular-nums">{data.indicators.rsi_14.toFixed(0)}</div>
              </div>
            )}
            {data.indicators.macd_histogram != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">MACD</div>
                <div className="font-mono font-semibold tabular-nums"
                     style={{ color: data.indicators.macd_bullish ? "#16A34A" : "#DC2626" }}>
                  {data.indicators.macd_histogram > 0 ? "+" : ""}{data.indicators.macd_histogram.toFixed(3)}
                </div>
              </div>
            )}
            {data.indicators.volume_ratio != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">Volume</div>
                <div className="font-mono font-semibold tabular-nums">{data.indicators.volume_ratio.toFixed(1)}×</div>
              </div>
            )}
            {data.indicators.atr_14 != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">ATR (14)</div>
                <div className="font-mono font-semibold tabular-nums">৳{data.indicators.atr_14.toFixed(2)}</div>
              </div>
            )}
            {data.indicators.ema_50 != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">EMA 50</div>
                <div className="font-mono font-semibold tabular-nums">৳{data.indicators.ema_50.toFixed(2)}</div>
              </div>
            )}
            {data.indicators.ema_200 != null && (
              <div>
                <div className="text-[10px] text-[var(--color-muted)]">EMA 200</div>
                <div className="font-mono font-semibold tabular-nums">৳{data.indicators.ema_200.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Red flags */}
      {data.red_flags.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.2)" }}>
          <div className="flex items-start gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M12 9v4M12 17h.01M5 21h14a2 2 0 001.75-2.98l-7-13a2 2 0 00-3.5 0l-7 13A2 2 0 005 21z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#D97706" }}>Red flags</h3>
          </div>
          <ul className="space-y-1.5 ml-6">
            {data.red_flags.map((f, i) => (
              <li key={i} className="text-sm text-[var(--color-muted)]">{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnalystUpsell({ ticker }: { ticker: string }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden relative"
         style={{ border: "1px solid rgba(0,102,204,0.15)", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,102,204,0.08)" }}>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent" />
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                style={{ background: "linear-gradient(135deg, rgba(0,102,204,0.1), rgba(0,102,204,0.04))", color: "#0066CC", border: "1px solid rgba(0,102,204,0.2)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Analyst Tier
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">for {ticker}</span>
        </div>
        <h3 className="font-display text-xl font-semibold mb-2">Unlock AI analysis for this stock</h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Signal · score · entry zone · 2 targets · multi-step stop-loss ladder · position sizing for your risk tier · support/resistance · red-flag alerts.
        </p>
        <ul className="space-y-1.5 mb-6 text-sm">
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
            <span>AI trade plan on <strong>any</strong> of 396 DSE stocks, not just our 3 daily picks</span>
          </li>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
            <span>Multi-step stop-loss ladder (trail profit as price rises)</span>
          </li>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><path d="M20 6L9 17l-5-5"/></svg>
            <span>Full DSE rankings — see all 396 stocks scored, sortable</span>
          </li>
        </ul>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/subscribe?tier=analyst"
                className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all hover:shadow-[0_8px_24px_rgba(0,102,204,0.3)] hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)", boxShadow: "0 2px 4px rgba(0,102,204,0.2), inset 0 1px 0 rgba(255,255,255,0.15)" }}>
            Upgrade to Analyst — ৳550/mo
          </Link>
          <span className="text-xs text-[var(--color-muted)]">or free 7-day trial</span>
        </div>
      </div>
    </div>
  );
}
