"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PnLCard } from "@/components/pnl-card";
import { StockSearch } from "@/components/stock-search";

interface Holding {
  id: string;
  ticker: string;
  company_name: string | null;
  company_name_bn: string | null;
  category: string | null;
  quantity: number;
  buy_price: number;
  invested: number;
  current_price: number | null;
  current_value: number | null;
  price_date: string | null;
  day_change_pct: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  is_stale: boolean;
}

interface PnLData {
  holdings: Holding[];
  summary: {
    total_holdings: number;
    total_invested: number;
    total_value: number;
    total_pnl: number;
    total_pnl_pct: number;
    as_of: string | null;
  };
  insights: string[];
}

interface StockAutocomplete {
  ticker: string;
  company_name: string;
  company_name_bn: string | null;
  category: string | null;
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const access = (session?.user as Record<string, unknown> | undefined)?.accessStatus as string | undefined;

  const [paywalled, setPaywalled] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio/pnl");
      if (res.status === 402) {
        setPaywalled(true);
        // Fall back to raw holdings list (CRUD still works)
        const rawRes = await fetch("/api/portfolio");
        if (rawRes.ok) {
          const raw = await rawRes.json();
          setData({
            holdings: (raw.holdings ?? []).map((h: Record<string, unknown>) => ({
              id: h.id,
              ticker: h.ticker,
              company_name: null,
              company_name_bn: null,
              category: null,
              quantity: Number(h.quantity),
              buy_price: Number(h.buy_price),
              invested: Number(h.quantity) * Number(h.buy_price),
              current_price: null,
              current_value: null,
              price_date: null,
              day_change_pct: null,
              pnl: null,
              pnl_pct: null,
              is_stale: false,
            })),
            summary: { total_holdings: (raw.holdings ?? []).length, total_invested: 0, total_value: 0, total_pnl: 0, total_pnl_pct: 0, as_of: null },
            insights: [],
          });
        }
      } else if (res.ok) {
        setPaywalled(false);
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/portfolio");
    if (status === "authenticated") fetchData();
  }, [status, router, fetchData]);

  async function handleDelete(id: string) {
    if (!confirm("Remove this holding?")) return;
    await fetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-sm text-[var(--color-muted)]">Loading portfolio...</div>
      </div>
    );
  }

  if (!session?.user) return null;

  const u = session.user as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={u.name as string | null}
        userEmail={u.email as string | null}
        accessStatus={access as "subscribed" | "trial" | "grace" | "expired" | undefined ?? null}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">Portfolio</h1>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              Your DSE holdings, tracked automatically
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white font-medium text-sm px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add holding
          </button>
        </div>

        {data && data.holdings.length > 0 && !paywalled && <PnLCard pnl={data.summary} insights={data.insights} />}
        {data && data.holdings.length > 0 && paywalled && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden relative" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="p-5" style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>
              <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Portfolio value</div>
              <div className="font-display text-3xl font-semibold">৳━━━━</div>
              <div className="mt-2 font-mono text-lg">P&L hidden</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <Link href="/subscribe" className="text-white text-sm font-semibold px-4 py-2 rounded-lg"
                style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)", boxShadow: "0 4px 12px rgba(0,102,204,0.3)" }}>
                Subscribe to unlock P&L
              </Link>
            </div>
          </div>
        )}

        {/* Holdings table */}
        {data && data.holdings.length > 0 && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Holdings</h2>
              <span className="text-xs text-[var(--color-muted)]">{data.holdings.length} stock{data.holdings.length === 1 ? "" : "s"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    <th className="px-5 py-3 text-left">Stock</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Buy</th>
                    <th className="px-3 py-3 text-right">Current</th>
                    <th className="px-3 py-3 text-right">Value</th>
                    <th className="px-3 py-3 text-right">P&L</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => {
                    const positive = (h.pnl_pct ?? 0) >= 0;
                    const color = positive ? "#16A34A" : "#DC2626";
                    return (
                      <tr key={h.id} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--background)] transition-colors">
                        <td className="px-5 py-3">
                          <Link href={`/stocks/${h.ticker}`} className="group">
                            <div className="font-mono font-semibold text-sm text-[var(--color-primary)] group-hover:underline">
                              {h.ticker}
                              {h.is_stale && <span title="Price data may be stale" className="ml-1 text-[#D97706]">⚠</span>}
                            </div>
                            {h.company_name && (
                              <div className="text-[11px] text-[var(--color-muted)] truncate max-w-[200px]">
                                {h.company_name}
                              </div>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{h.quantity}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">৳{h.buy_price.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {h.current_price != null ? `৳${h.current_price.toFixed(2)}` : "—"}
                          {h.day_change_pct != null && h.current_price != null && (
                            <div className="text-[10px]" style={{ color: h.day_change_pct >= 0 ? "#16A34A" : "#DC2626" }}>
                              {h.day_change_pct >= 0 ? "+" : ""}{h.day_change_pct.toFixed(2)}%
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          ৳{(h.current_value ?? h.invested).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {h.pnl != null ? (
                            <div>
                              <div style={{ color }}>
                                {positive ? "+" : ""}৳{Math.abs(h.pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-[10px]" style={{ color }}>
                                {positive ? "+" : ""}{(h.pnl_pct ?? 0).toFixed(2)}%
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDelete(h.id)}
                            aria-label="Delete"
                            className="text-[var(--color-muted)] hover:text-[#DC2626] transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Explore CTA when zero holdings */}
        {data && data.holdings.length === 0 && (
          <div className="bg-gradient-to-br from-[rgba(0,102,204,0.04)] to-transparent border border-[rgba(0,102,204,0.15)] rounded-xl p-8 text-center">
            <h3 className="font-display text-lg font-semibold mb-2">Start tracking your DSE portfolio</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4 font-bengali">
              আপনার প্রথম স্টক যোগ করুন অথবা নিচে সার্চ করে শুরু করুন
            </p>
            <div className="max-w-sm mx-auto mb-4">
              <StockSearch placeholder="Search any DSE stock..." />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Or add a holding manually →
            </button>
          </div>
        )}
      </main>

      {showForm && <AddHoldingModal onClose={() => setShowForm(false)} onAdded={fetchData} />}
    </div>
  );
}

function AddHoldingModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split("T")[0]);
  const [suggestions, setSuggestions] = useState<StockAutocomplete[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tickerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!ticker || ticker.length < 1) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(ticker)}&limit=5`);
        const d = await res.json();
        setSuggestions(d.results ?? []);
      } catch { /* ignore */ }
    }, 150);
  }, [ticker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!ticker.trim() || !quantity || !buyPrice) return;
    setSubmitting(true);
    try {
      const matched = suggestions.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          company_name: matched?.company_name ?? ticker.toUpperCase(),
          buy_price: parseFloat(buyPrice),
          quantity: parseInt(quantity),
          buy_date: buyDate,
          notes: null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to add");
        setSubmitting(false);
        return;
      }
      onAdded();
      onClose();
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Add holding</h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--foreground)]" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">Stock</label>
            <div className="relative">
              <input
                ref={tickerRef}
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Type ticker or company name..."
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                required
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.ticker}
                      type="button"
                      onClick={() => { setTicker(s.ticker); setSuggestions([]); }}
                      className="w-full text-left px-3 py-2 border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--background)]"
                    >
                      <div className="font-mono font-semibold text-sm text-[var(--color-primary)]">{s.ticker}</div>
                      <div className="text-[11px] text-[var(--color-muted)] truncate">{s.company_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                min="1"
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">Buy price (৳)</label>
              <input
                type="number"
                step="0.01"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="125.50"
                min="0.01"
                className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-1.5">Buy date</label>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          {error && <div className="text-xs text-[#DC2626]">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[var(--color-border)] text-sm font-medium py-2.5 rounded-lg hover:bg-[var(--background)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[var(--color-primary)] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add holding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
