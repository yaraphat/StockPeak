import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";
import { getUserAccess, hasActiveAccess } from "@/lib/access";
import { StockChartClient } from "./chart-client";
import { StockSearch } from "@/components/stock-search";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

interface StockRow {
  ticker: string;
  company_name: string;
  company_name_bn: string | null;
  category: string | null;
  sector: string | null;
}

async function getStock(ticker: string): Promise<StockRow | null> {
  const sql = getDb();
  try {
    const [row] = await sql`
      SELECT ticker, company_name, company_name_bn, category, sector
      FROM dse_stocks WHERE ticker = ${ticker}
    `;
    return (row as unknown as StockRow) ?? null;
  } catch {
    return null;
  }
}

async function getLatestPrice(ticker: string) {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT date::text, close, change_pct, volume
      FROM stock_data WHERE ticker = ${ticker}
      ORDER BY date DESC LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function get52WeekStats(ticker: string) {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT MAX(high) AS high, MIN(low) AS low
      FROM stock_data
      WHERE ticker = ${ticker} AND date >= CURRENT_DATE - INTERVAL '52 weeks'
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  const userId = user?.id as string | undefined;
  const access = userId ? await getUserAccess(userId) : null;
  const paid = hasActiveAccess(access);

  const [stock, latest, stats] = await Promise.all([
    getStock(ticker),
    getLatestPrice(ticker),
    get52WeekStats(ticker),
  ]);

  if (!stock) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        {userId ? (
          <AppHeader
            userName={(user as Record<string, unknown>).name as string | null}
            userEmail={(user as Record<string, unknown>).email as string | null}
            accessStatus={access?.accessStatus ?? null}
            trialDaysRemaining={access?.trialDaysRemaining ?? null}
          />
        ) : <PublicHeader />}
        <main className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold mb-2">Stock not found</h1>
          <p className="text-[var(--color-muted)] mb-6">
            <span className="font-mono">{ticker}</span> is not in our DSE database.
          </p>
          <div className="max-w-md mx-auto">
            <StockSearch placeholder="Try another ticker..." autoFocus />
          </div>
        </main>
      </div>
    );
  }

  const changePositive = latest && Number(latest.change_pct) >= 0;
  const changeColor = changePositive ? "#16A34A" : "#DC2626";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {userId ? (
        <AppHeader
          userName={(user as Record<string, unknown>).name as string | null}
          userEmail={(user as Record<string, unknown>).email as string | null}
          accessStatus={access?.accessStatus ?? null}
          trialDaysRemaining={access?.trialDaysRemaining ?? null}
        />
      ) : <PublicHeader />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Ticker header */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-mono text-2xl font-bold text-[var(--color-primary)]">{stock.ticker}</h1>
                {stock.category && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    stock.category === "A" ? "bg-[rgba(22,163,74,0.1)] text-[#16A34A]" :
                    stock.category === "Z" ? "bg-[rgba(220,38,38,0.1)] text-[#DC2626]" :
                    "bg-[var(--background)] text-[var(--color-muted)]"
                  }`}>
                    Cat {stock.category}
                  </span>
                )}
                {stock.sector && (
                  <span className="text-xs text-[var(--color-muted)]">{stock.sector}</span>
                )}
              </div>
              <h2 className="font-display text-lg text-[var(--foreground)]">{stock.company_name}</h2>
              {stock.company_name_bn && (
                <p className="text-sm text-[var(--color-muted)] font-bengali">{stock.company_name_bn}</p>
              )}
            </div>

            {latest && (
              <div className="text-right">
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  ৳{Number(latest.close).toFixed(2)}
                </div>
                <div className="font-mono text-sm tabular-nums" style={{ color: changeColor }}>
                  {changePositive ? "+" : ""}{Number(latest.change_pct).toFixed(2)}%
                </div>
                <div className="text-[10px] text-[var(--color-muted)] mt-1">
                  As of {new Date(latest.date as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            )}
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-[var(--color-border-subtle)]">
              <div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-0.5">52W High</div>
                <div className="font-mono text-sm font-medium">৳{Number(stats.high ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-0.5">52W Low</div>
                <div className="font-mono text-sm font-medium">৳{Number(stats.low ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Volume</div>
                <div className="font-mono text-sm font-medium">
                  {latest ? Number(latest.volume).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Price history</h3>
          </div>
          <StockChartClient ticker={ticker} paid={paid} loggedIn={!!userId} />
        </div>

        {stock.category === "Z" && (
          <div className="mt-4 bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-xl p-4">
            <p className="text-xs text-[#DC2626] font-medium mb-1">Z-category warning</p>
            <p className="text-xs text-[var(--color-muted)] font-bengali">
              এই স্টকটি Z-ক্যাটেগরিতে — AGM বা ডিভিডেন্ড ডিফল্ট, T+9 সেটেলমেন্ট। উচ্চ ঝুঁকি।
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
        <Link href="/" className="font-display font-semibold text-lg tracking-tight">
          Stock Peak
        </Link>
        <div className="flex-1 flex justify-center">
          <StockSearch compact />
        </div>
        <Link href="/login" className="text-sm text-[var(--color-muted)] hover:text-[var(--foreground)]">Sign in</Link>
        <Link href="/signup" className="text-sm font-medium bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg">Get started</Link>
      </div>
    </header>
  );
}
