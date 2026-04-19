"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PriceChart } from "@/components/price-chart";

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

export function StockChartClient({ ticker, paid, loggedIn }: { ticker: string; paid: boolean; loggedIn: boolean }) {
  const [days, setDays] = useState(paid ? 90 : 30);
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [type, setType] = useState<"candlestick" | "line">("candlestick");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stocks/${ticker}/history?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.data ?? []);
        setGated(!!d.gated);
      })
      .finally(() => setLoading(false));
  }, [ticker, days]);

  const maxUnauth = 180; // keep in sync with MAX_DAYS_UNAUTH in /api/stocks/[t]/history

  return (
    <div>
      {/* Range selector + type toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
          {RANGES.map((r) => {
            const locked = !paid && r.days > maxUnauth;
            const active = days === r.days;
            return (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                disabled={locked}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : locked
                    ? "text-[var(--color-muted)] opacity-50 cursor-not-allowed"
                    : "text-[var(--color-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {r.label}
                {locked && " 🔒"}
              </button>
            );
          })}
        </div>

        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
          <button
            onClick={() => setType("candlestick")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              type === "candlestick" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"
            }`}
          >
            Candles
          </button>
          <button
            onClick={() => setType("line")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              type === "line" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)]"
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center text-sm text-[var(--color-muted)]">
          Loading chart...
        </div>
      ) : data.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center">
          <div className="text-sm text-[var(--color-muted)] mb-2">No price history for {ticker} yet</div>
          <div className="text-xs text-[var(--color-muted)]">
            Historical data populates during daily market close.
          </div>
        </div>
      ) : (
        <PriceChart data={data as never} type={type} height={320} />
      )}

      {gated && !paid && (
        <div className="mt-4 bg-gradient-to-r from-[rgba(0,102,204,0.06)] to-transparent border border-[rgba(0,102,204,0.2)] rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-0.5">Full history is a Pro feature</p>
            <p className="text-xs text-[var(--color-muted)] font-bengali">
              ২ বছর পর্যন্ত ঐতিহাসিক ডেটা দেখতে সাবস্ক্রাইব করুন — ৳২৬০/মাস
            </p>
          </div>
          <Link
            href={loggedIn ? "/subscribe" : "/signup"}
            className="text-sm font-medium bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors flex-shrink-0"
          >
            {loggedIn ? "Subscribe →" : "Start trial"}
          </Link>
        </div>
      )}
    </div>
  );
}
