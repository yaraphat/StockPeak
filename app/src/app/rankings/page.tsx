"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";

type Signal = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

interface Rank {
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
}

interface Response {
  total: number;
  filtered: number;
  as_of: string | null;
  rankings: Rank[];
  counts_by_signal: Record<Signal, number>;
}

const SIGNAL_META: Record<Signal, { bg: string; fg: string; order: number }> = {
  "STRONG BUY":  { bg: "rgba(22,163,74,0.15)",  fg: "#15803D", order: 0 },
  "BUY":         { bg: "rgba(22,163,74,0.08)",  fg: "#16A34A", order: 1 },
  "HOLD":        { bg: "rgba(120,113,108,0.1)", fg: "#78716C", order: 2 },
  "SELL":        { bg: "rgba(220,38,38,0.08)",  fg: "#DC2626", order: 3 },
  "STRONG SELL": { bg: "rgba(220,38,38,0.15)",  fg: "#991B1B", order: 4 },
};

export default function RankingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [sort, setSort] = useState<"score" | "rsi" | "volume" | "ticker" | "change">("score");
  const [signalFilter, setSignalFilter] = useState<Signal | "ALL">("ALL");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ sort, limit: "400" });
      if (signalFilter !== "ALL") q.set("signal", signalFilter.replace(/ /g, "_"));
      const res = await fetch(`/api/rankings?${q}`);
      if (res.status === 402) { setGated(true); return; }
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [sort, signalFilter]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/rankings");
    if (status === "authenticated") fetchData();
  }, [status, router, fetchData]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-muted)]">Loading...</div>;
  }

  const u = (session?.user as Record<string, unknown>) ?? {};

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={u.name as string | null}
        userEmail={u.email as string | null}
        accessStatus={(u.accessStatus as "subscribed" | "trial" | "grace" | "expired") ?? null}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">DSE Rankings</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              All actively-traded DSE stocks, scored and signaled by our AI engine
            </p>
          </div>
          {data?.as_of && (
            <div className="text-right">
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">As of</div>
              <div className="font-mono text-sm font-medium">{data.as_of}</div>
            </div>
          )}
        </div>

        {gated ? (
          <AnalystUpsell />
        ) : loading ? (
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-12 text-center text-sm text-[var(--color-muted)]">
            Scanning all DSE stocks...
          </div>
        ) : !data ? (
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-12 text-center text-sm text-[var(--color-muted)]">
            Failed to load rankings.
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden"
                 style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
              <div className="grid grid-cols-5 divide-x divide-[var(--color-border-subtle)]">
                {(Object.entries(data.counts_by_signal) as [Signal, number][])
                  .sort(([a], [b]) => SIGNAL_META[a].order - SIGNAL_META[b].order)
                  .map(([s, count]) => (
                    <button
                      key={s}
                      onClick={() => setSignalFilter(signalFilter === s ? "ALL" : s)}
                      className={`p-4 text-center transition-colors ${signalFilter === s ? "bg-[var(--background)]" : "hover:bg-[var(--background)]"}`}
                    >
                      <div className="text-xl font-bold" style={{ color: SIGNAL_META[s].fg }}>{count}</div>
                      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: SIGNAL_META[s].fg }}>
                        {s}
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Sort by</span>
              {(["score", "change", "rsi", "volume", "ticker"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                    sort === s
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-white border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s === "score" ? "Score" : s === "change" ? "Day change" : s.toUpperCase()}
                </button>
              ))}
              {signalFilter !== "ALL" && (
                <button
                  onClick={() => setSignalFilter("ALL")}
                  className="text-xs font-medium text-[var(--color-primary)] hover:underline ml-auto"
                >
                  Clear filter ({signalFilter}) ×
                </button>
              )}
            </div>

            {/* Table */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden"
                 style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--background)]">
                    <tr className="border-b border-[var(--color-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      <th className="px-4 py-3 text-left">Stock</th>
                      <th className="px-3 py-3 text-right">Price</th>
                      <th className="px-3 py-3 text-right">Day</th>
                      <th className="px-3 py-3 text-center">Signal</th>
                      <th className="px-3 py-3 text-right">Score</th>
                      <th className="px-3 py-3 text-right">RSI</th>
                      <th className="px-3 py-3 text-right">Vol</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rankings.map((r) => {
                      const sm = SIGNAL_META[r.signal];
                      const positive = (r.change_pct ?? 0) >= 0;
                      return (
                        <tr key={r.ticker} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--background)] transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/stocks/${r.ticker}`} className="group block">
                              <div className="font-mono font-semibold text-sm text-[var(--color-primary)] group-hover:underline">
                                {r.ticker}
                                {r.category === "Z" && <span title="Z-category — avoid" className="ml-1 text-[#DC2626]">⚠</span>}
                              </div>
                              {r.company_name && r.company_name.toUpperCase() !== r.ticker && (
                                <div className="text-[11px] text-[var(--color-muted)] truncate max-w-[180px]">{r.company_name}</div>
                              )}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">৳{r.current_price.toFixed(2)}</td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums" style={{ color: positive ? "#16A34A" : "#DC2626" }}>
                            {positive ? "+" : ""}{(r.change_pct ?? 0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider"
                                  style={{ background: sm.bg, color: sm.fg }}>
                              {r.signal}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums font-semibold" style={{ color: r.score > 0 ? "#16A34A" : r.score < 0 ? "#DC2626" : "#78716C" }}>
                            {r.score > 0 ? "+" : ""}{r.score}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                            {r.rsi_14 != null ? r.rsi_14.toFixed(0) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                            {r.volume_ratio != null ? `${r.volume_ratio.toFixed(1)}×` : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/stocks/${r.ticker}`} className="text-xs text-[var(--color-primary)] hover:underline">
                              Analyze →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.rankings.length === 0 && (
                <div className="p-8 text-center text-sm text-[var(--color-muted)]">
                  No stocks match this filter. Try clearing filters.
                </div>
              )}
            </div>

            <p className="text-xs text-[var(--color-muted)] font-bengali text-center">
              শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়। প্রতিটি স্টকে নিজের বিচার ব্যবহার করুন।
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function AnalystUpsell() {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-8 text-center max-w-lg mx-auto"
         style={{ boxShadow: "0 8px 24px rgba(0,102,204,0.08)" }}>
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4"
           style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)", boxShadow: "0 4px 12px rgba(0,102,204,0.3)" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/>
          <path d="M7 16l4-4 4 4 6-6"/>
        </svg>
      </div>
      <h2 className="font-display text-xl font-semibold mb-2">Rankings are an Analyst-tier feature</h2>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        See today&apos;s signal and score for <strong>every</strong> actively-traded DSE stock, not just our top 3 picks.
        Filter by signal, sort by momentum, drill into trade plans on any stock.
      </p>
      <Link href="/subscribe?tier=analyst"
            className="inline-block text-white text-sm font-semibold px-6 py-3 rounded-lg"
            style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)", boxShadow: "0 4px 12px rgba(0,102,204,0.3)" }}>
        Upgrade to Analyst — ৳550/month
      </Link>
    </div>
  );
}
