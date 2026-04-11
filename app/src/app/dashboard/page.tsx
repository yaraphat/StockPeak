import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTodaysPicks, getScorecard } from "@/lib/db";
import { getDb } from "@/lib/postgres";
import { PickCard } from "@/components/pick-card";
import { MarketMood } from "@/components/market-mood";
import { Scorecard } from "@/components/scorecard";
import { RiskProfileBadge, RiskProfileBanner } from "@/components/risk-profile-banner";

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

export default async function DashboardPage() {
  let picks;
  let scorecard;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
  const riskProfile = userId ? await getUserRiskProfile(userId) : null;

  try {
    [picks, scorecard] = await Promise.all([getTodaysPicks(), getScorecard()]);
  } catch {
    // DB not configured yet — show placeholder
    return <DashboardPlaceholder />;
  }

  const mood = picks[0]?.market_mood ?? "neutral";
  const moodReason = picks[0]?.market_mood_reason ?? "";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display font-semibold text-lg">
            Stock Peak
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/track-record" className="text-[var(--color-muted)] hover:text-[var(--foreground)] transition-colors">
              Track Record
            </Link>
            {riskProfile?.riskTier && (
              <RiskProfileBadge riskTier={riskProfile.riskTier} />
            )}
            <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full font-medium">
              Pro
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          {riskProfile && !riskProfile.hasCompletedQuestionnaire && (
            <RiskProfileBanner
              hasCompletedQuestionnaire={riskProfile.hasCompletedQuestionnaire}
              riskTier={riskProfile.riskTier}
            />
          )}
          <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-border)]">
            <h1 className="font-display text-xl font-semibold">
              Today&apos;s Picks
            </h1>
            <span className="text-sm text-[var(--color-muted)]">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          {mood && <MarketMood mood={mood} reason={moodReason} />}

          {picks.length > 0 ? (
            <div className="p-4 space-y-3">
              {picks.map((pick) => (
                <PickCard key={pick.id} pick={pick} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-[var(--color-muted)] font-bengali">
                আজকের পিক এখনও প্রকাশিত হয়নি। সকাল ৭টায় আবার দেখুন।
              </p>
            </div>
          )}

          {scorecard.total_picks > 0 && (
            <div className="mx-4 mb-4">
              <Scorecard data={scorecard} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display font-semibold text-lg">
            Stock Peak
          </Link>
          <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full font-medium">
            Pro
          </span>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden p-8 text-center">
          <h1 className="font-display text-xl font-semibold mb-4">Dashboard</h1>
          <p className="text-[var(--color-muted)] mb-4 font-bengali">
            ডেটাবেস কনফিগার করা হয়নি অথবা এখনও কোনো পিক প্রকাশিত হয়নি।
          </p>
          <p className="text-[var(--color-muted)] text-sm">
            Set <code className="bg-[var(--background)] px-1 rounded font-mono text-xs">DATABASE_URL</code> environment variable to connect.
          </p>
        </div>
      </main>
    </div>
  );
}
