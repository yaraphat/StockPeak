"use client";

import Link from "next/link";

interface PnL {
  total_holdings: number;
  total_invested: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  as_of: string | null;
}

export function PnLCard({ pnl, insights, compact = false }: { pnl: PnL; insights?: string[]; compact?: boolean }) {
  const positive = pnl.total_pnl >= 0;
  const color = positive ? "#16A34A" : "#DC2626";
  const bgTint = positive ? "rgba(22,163,74,0.04)" : "rgba(220,38,38,0.04)";

  if (pnl.total_holdings === 0) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 text-center">
        <div className="text-sm font-medium text-[var(--foreground)] mb-1">No holdings yet</div>
        <p className="text-sm text-[var(--color-muted)] font-bengali mb-4">
          আপনার প্রথম স্টক যোগ করুন — P&L ট্র্যাকিং শুরু হবে
        </p>
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Add a holding
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <div className="p-5" style={{ background: `linear-gradient(180deg, ${bgTint} 0%, transparent 100%)` }}>
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
            Portfolio value
          </span>
          {pnl.as_of && (
            <span className="text-[10px] text-[var(--color-muted)] font-mono">
              As of {new Date(pnl.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <div className="font-display text-3xl font-semibold tabular-nums">
          ৳{pnl.total_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
            {positive ? "+" : ""}৳{Math.abs(pnl.total_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
          <span className="font-mono text-sm" style={{ color }}>
            ({positive ? "+" : ""}{pnl.total_pnl_pct.toFixed(2)}%)
          </span>
          <span className="text-xs text-[var(--color-muted)]">unrealized</span>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 border-t border-[var(--color-border-subtle)]">
          <div className="p-4 border-r border-[var(--color-border-subtle)]">
            <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Invested</div>
            <div className="font-mono text-sm font-medium tabular-nums">
              ৳{pnl.total_invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Holdings</div>
            <div className="font-mono text-sm font-medium tabular-nums">
              {pnl.total_holdings}
            </div>
          </div>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)] p-4 bg-[var(--background)]">
          {insights.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-muted)] font-bengali mb-1 last:mb-0">
              <span className="text-[var(--color-primary)]">•</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
