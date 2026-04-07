"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Holding {
  id: string;
  ticker: string;
  company_name: string;
  buy_price: number;
  quantity: number;
  buy_date: string;
  notes: string | null;
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ticker: "",
    company_name: "",
    buy_price: "",
    quantity: "",
    buy_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchHoldings();
  }, [status, router]);

  async function fetchHoldings() {
    setLoading(true);
    const res = await fetch("/api/portfolio");
    if (res.ok) {
      const data = await res.json();
      setHoldings(data.holdings);
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        buy_price: parseFloat(formData.buy_price),
        quantity: parseInt(formData.quantity),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || "Failed to add holding");
      return;
    }

    setFormData({ ticker: "", company_name: "", buy_price: "", quantity: "", buy_date: new Date().toISOString().split("T")[0], notes: "" });
    setShowForm(false);
    fetchHoldings();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
    fetchHoldings();
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--color-muted)]">Loading...</p>
      </div>
    );
  }

  const totalInvested = holdings.reduce((sum, h) => sum + h.buy_price * h.quantity, 0);
  const totalShares = holdings.reduce((sum, h) => sum + h.quantity, 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors">Picks</Link>
            <Link href="/portfolio" className="text-[var(--color-primary)] font-medium">Portfolio</Link>
            <Link href="/track-record" className="text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors">Track Record</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Portfolio</h1>
            <p className="font-bengali text-sm text-[var(--color-muted)]">আপনার স্টক পোর্টফোলিও ট্র্যাক করুন</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold px-4 py-2 rounded-lg transition-opacity text-sm"
          >
            {showForm ? "Cancel" : "+ Add Stock"}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-center">
            <div className="font-mono text-xl font-medium tabular-nums">{holdings.length}</div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Holdings</div>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-center">
            <div className="font-mono text-xl font-medium tabular-nums">{totalShares.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Total Shares</div>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 text-center">
            <div className="font-mono text-xl font-medium tabular-nums">৳{totalInvested.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Invested</div>
          </div>
        </div>

        {/* Add Stock Form */}
        {showForm && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">Add Stock to Portfolio</h2>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
            )}
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Ticker Symbol</label>
                <input type="text" value={formData.ticker} onChange={(e) => setFormData({ ...formData, ticker: e.target.value })} placeholder="e.g. GP" className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm font-mono uppercase focus:outline-none focus:border-[var(--color-primary)] transition" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Company Name</label>
                <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Grameenphone Ltd." className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition" disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Buy Price (৳)</label>
                <input type="number" step="0.01" value={formData.buy_price} onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })} placeholder="450.00" className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] transition" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Quantity</label>
                <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="100" className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm font-mono focus:outline-none focus:border-[var(--color-primary)] transition" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Buy Date</label>
                <input type="date" value={formData.buy_date} onChange={(e) => setFormData({ ...formData, buy_date: e.target.value })} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition" disabled={submitting} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Notes</label>
                <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition" disabled={submitting} />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={submitting} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-2.5 rounded-lg transition-opacity text-sm disabled:opacity-50">
                  {submitting ? "Adding..." : "Add to Portfolio"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Holdings List */}
        {holdings.length > 0 ? (
          <div className="space-y-3">
            {holdings.map((h) => (
              <div key={h.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-[var(--color-primary)] font-medium text-sm">{h.ticker}</span>
                    <p className="text-xs text-[var(--color-muted)]">{h.company_name}</p>
                  </div>
                  <button onClick={() => handleDelete(h.id)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors">Remove</button>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                  <div>
                    <div className="text-xs text-[var(--color-muted)]">Buy Price</div>
                    <div className="font-mono text-sm tabular-nums">৳{Number(h.buy_price).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-muted)]">Quantity</div>
                    <div className="font-mono text-sm tabular-nums">{h.quantity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-muted)]">Total Value</div>
                    <div className="font-mono text-sm tabular-nums">৳{(Number(h.buy_price) * h.quantity).toLocaleString()}</div>
                  </div>
                </div>
                {h.notes && <p className="text-xs text-[var(--color-muted)] mt-2">{h.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center">
            <p className="font-bengali text-[var(--color-muted)] mb-2">আপনার পোর্টফোলিও খালি</p>
            <p className="text-sm text-[var(--color-muted)]">Click &quot;+ Add Stock&quot; to start tracking your investments.</p>
          </div>
        )}
      </main>
    </div>
  );
}
