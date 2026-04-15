import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getTodaysPicks, getScorecard } from "@/lib/db";
import { getDb } from "@/lib/postgres";
import { getUserAccess, hasActiveAccess } from "@/lib/access";
import { PickCard } from "@/components/pick-card";
import { MarketMood } from "@/components/market-mood";
import { Scorecard } from "@/components/scorecard";
import { RiskProfileBanner } from "@/components/risk-profile-banner";
import { AppHeader } from "@/components/app-header";
import { PnLCard } from "@/components/pnl-card";
import { TrialBanner } from "@/components/trial-banner";
import { PaywallOverlay } from "@/components/paywall-overlay";

export const dynamic = "force-dynamic";

async function getUserRiskProfile(userId: string) {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT risk_tier, risk_profile_set_at FROM users WHERE id = ${userId}
    `;
    if (rows.length === 0) return null;
    return {
      riskTier: rows[0].risk_tier as string,
      hasCompletedQuestionnaire: rows[0].risk_profile_set_at !== null,
    };
  } catch {
    return null;
  }
}

interface PnLResponse {
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

async function getPnL(userId: string): Promise<PnLResponse | null> {
  try {
    const sql = getDb();
    const holdings = await sql`
      SELECT ph.ticker, ph.quantity::numeric AS quantity, ph.buy_price::numeric AS buy_price,
             latest.close::numeric AS current_price, latest.date::text AS price_date, ds.category
      FROM portfolio_holdings ph
      LEFT JOIN dse_stocks ds ON ds.ticker = ph.ticker
      LEFT JOIN LATERAL (
        SELECT close, date FROM stock_data WHERE ticker = ph.ticker ORDER BY date DESC LIMIT 1
      ) latest ON true
      WHERE ph.user_id = ${userId}
    `;
    const totalInvested = holdings.reduce(
      (a: number, h: Record<string, unknown>) => a + Number(h.quantity) * Number(h.buy_price), 0
    );
    const totalValue = holdings.reduce(
      (a: number, h: Record<string, unknown>) =>
        a + Number(h.quantity) * Number(h.current_price ?? h.buy_price), 0
    );
    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    const insights: string[] = [];
    if (holdings.length > 0) {
      const winners = holdings.filter((h: Record<string, unknown>) =>
        h.current_price != null && Number(h.current_price) > Number(h.buy_price)
      );
      const losers = holdings.filter((h: Record<string, unknown>) =>
        h.current_price != null && Number(h.current_price) < Number(h.buy_price)
      );
      if (winners.length > losers.length) {
        insights.push(`${winners.length}/${holdings.length} holdings in profit`);
      } else if (losers.length > winners.length) {
        insights.push(`${losers.length}/${holdings.length} holdings in loss — review positions`);
      }
    }

    return {
      summary: {
        total_holdings: holdings.length,
        total_invested: totalInvested,
        total_value: totalValue,
        total_pnl: totalPnl,
        total_pnl_pct: totalPnlPct,
        as_of: (holdings[0] as Record<string, unknown> | undefined)?.price_date as string | null ?? null,
      },
      insights,
    };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) redirect("/login?callbackUrl=/dashboard");

  const userId = user.id as string;
  const [access, riskProfile, pnl] = await Promise.all([
    getUserAccess(userId),
    getUserRiskProfile(userId),
    getPnL(userId),
  ]);

  let picks, scorecard;
  try {
    [picks, scorecard] = await Promise.all([getTodaysPicks(), getScorecard()]);
  } catch {
    return <DashboardPlaceholder userName={user.name as string | null} userEmail={user.email as string | null} access={access} />;
  }

  const canSeePicks = hasActiveAccess(access);
  const mood = picks[0]?.market_mood ?? "neutral";
  const moodReason = picks[0]?.market_mood_reason ?? "";

  // Smart greeting based on time
  const bdtHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })).getHours();
  const greeting = bdtHour < 12 ? "Good morning" : bdtHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name as string | null)?.split(" ")[0] ?? null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={user.name as string | null}
        userEmail={user.email as string | null}
        riskTier={riskProfile?.riskTier}
        accessStatus={access?.accessStatus ?? null}
        trialDaysRemaining={access?.trialDaysRemaining ?? null}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Dhaka" })}
          </p>
        </div>

        {/* Trial banner */}
        {access?.accessStatus === "trial" && access.trialDaysRemaining != null && access.trialDaysRemaining <= 3 && (
          <TrialBanner daysRemaining={access.trialDaysRemaining} />
        )}

        {/* Risk profile nudge */}
        {riskProfile && !riskProfile.hasCompletedQuestionnaire && (
          <RiskProfileBanner
            hasCompletedQuestionnaire={riskProfile.hasCompletedQuestionnaire}
            riskTier={riskProfile.riskTier}
          />
        )}

        {/* Two-column: P&L + Today's picks — both gated to active access */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.5fr] gap-4">
          {/* P&L — Pro feature */}
          <div>
            {canSeePicks && pnl && <PnLCard pnl={pnl.summary} insights={pnl.insights} />}
            {!canSeePicks && (
              <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden relative" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div className="p-5" style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>
                  <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Portfolio value</div>
                  <div className="font-display text-3xl font-semibold">৳━━━━</div>
                  <div className="mt-2 font-mono text-lg">+৳━━ (+━%)</div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                  <Link
                    href="/subscribe"
                    className="text-white text-sm font-semibold px-4 py-2 rounded-lg"
                    style={{ background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)", boxShadow: "0 4px 12px rgba(0,102,204,0.3)" }}
                  >
                    Subscribe to unlock P&L
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Today's picks */}
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="font-display text-lg font-semibold">Today's Picks</h2>
                {picks.length > 0 && (
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {picks.length} AI-analyzed DSE stock{picks.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              {picks[0]?.confidence != null && (
                <div className="text-right">
                  <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Top confidence</div>
                  <div className="font-mono text-sm font-semibold">
                    {Math.max(...picks.map((p) => Number(p.confidence)))}/10
                  </div>
                </div>
              )}
            </div>

            {mood && <MarketMood mood={mood} reason={moodReason} />}

            {!canSeePicks ? (
              <div className="p-4">
                <PaywallOverlay message="Subscribe to see today's picks" />
              </div>
            ) : picks.length > 0 ? (
              <div className="p-4 space-y-3">
                {picks.map((pick) => <PickCard key={pick.id} pick={pick} />)}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-3xl mb-2">🕐</div>
                <p className="text-[var(--color-muted)] font-bengali mb-1">আজকের পিক এখনও প্রকাশিত হয়নি</p>
                <p className="text-xs text-[var(--color-muted)]">Picks publish at ~10:30 AM BDT on trading days</p>
              </div>
            )}
          </div>
        </div>

        {/* Scorecard */}
        {scorecard.total_picks > 0 && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Track record</h2>
              <Link href="/track-record" className="text-xs text-[var(--color-primary)] hover:underline">
                See all →
              </Link>
            </div>
            <div className="p-4">
              <Scorecard data={scorecard} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DashboardPlaceholder({ userName, userEmail, access }: { userName: string | null; userEmail: string | null; access: Awaited<ReturnType<typeof getUserAccess>> }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={userName}
        userEmail={userEmail}
        accessStatus={access?.accessStatus ?? null}
        trialDaysRemaining={access?.trialDaysRemaining ?? null}
      />
      <main className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold mb-3">Getting things ready...</h1>
        <p className="text-[var(--color-muted)] mb-6 font-bengali">
          আপনার ড্যাশবোর্ড সেটআপ হচ্ছে। শীঘ্রই প্রথম পিক আসবে।
        </p>
        <Link href="/portfolio" className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-medium">
          Add your first holding
        </Link>
      </main>
    </div>
  );
}
