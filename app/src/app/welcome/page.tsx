import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAccess } from "@/lib/access";
import { getDb } from "@/lib/postgres";
import { AppHeader } from "@/components/app-header";
import { StockSearch } from "@/components/stock-search";

export const dynamic = "force-dynamic";

async function getRecentPicksWithOutcomes(limit = 5) {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT p.ticker, p.date, p.buy_zone, p.target, p.stop_loss, p.confidence,
             p.reasoning_bn, po.outcome, po.gain_pct
      FROM picks p
      LEFT JOIN pick_outcomes po ON po.pick_id = p.id
      WHERE po.outcome IN ('target_hit', 'stop_hit')
      ORDER BY p.date DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch {
    return [];
  }
}

function nextMarketOpen(): Date {
  // DSE trades Sun-Thu. Hours 10:00-14:30 BDT.
  const now = new Date();
  const bdtNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  const weekday = bdtNow.getDay();
  const h = bdtNow.getHours();
  const isMarketHours = weekday >= 0 && weekday <= 4 && h >= 10 && h < 15;
  if (isMarketHours) return bdtNow;

  const next = new Date(bdtNow);
  next.setHours(10, 0, 0, 0);
  // Tomorrow is today if we're before 10 AM on a trading day
  if (!(weekday >= 0 && weekday <= 4 && h < 10)) next.setDate(next.getDate() + 1);

  // Skip Fri (5) and Sat (6)
  while (next.getDay() === 5 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) redirect("/login");

  const [access, samplePicks] = await Promise.all([
    getUserAccess(user.id as string),
    getRecentPicksWithOutcomes(5),
  ]);

  // If already onboarded (completed risk quiz), skip welcome
  const sql = getDb();
  const [profile] = await sql`
    SELECT risk_profile_set_at, onboarded_at FROM users WHERE id = ${user.id as string}
  `;
  if (profile?.onboarded_at) redirect("/dashboard");

  const marketOpen = nextMarketOpen();
  const isOpenNow = marketOpen.getTime() <= Date.now() + 3600_000;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={user.name as string | null}
        userEmail={user.email as string | null}
        accessStatus={access?.accessStatus ?? null}
        trialDaysRemaining={access?.trialDaysRemaining ?? null}
        currentTier={access?.currentTier ?? null}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-3">
            Welcome to Stock Peak
          </h1>
          <p className="text-lg text-[var(--color-muted)] font-bengali">
            স্টক পিক, পোর্টফোলিও ট্র্যাকিং, এবং ডিএসই চার্ট — সব এক জায়গায়
          </p>
          {access?.trialDaysRemaining != null && access.trialDaysRemaining > 0 && (
            <div className="inline-flex items-center gap-2 mt-4 bg-[rgba(0,102,204,0.06)] border border-[rgba(0,102,204,0.2)] rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              <span className="text-sm font-medium text-[var(--color-primary)]">
                Your {access.trialDaysRemaining}-day free trial is active
              </span>
            </div>
          )}
        </div>

        {/* What happens next card */}
        <div className="bg-white border border-[var(--color-border)] rounded-xl p-6 mb-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <h2 className="font-display text-lg font-semibold mb-4">Here's what happens next</h2>
          <div className="space-y-4">
            {[
              {
                num: 1,
                title: isOpenNow ? "Today's picks are live" : "Next picks arrive at " + marketOpen.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }) + " BDT",
                desc: "Every trading day (Sun-Thu), Stock Peak publishes 3 AI-analyzed DSE picks with entry, target, and stop-loss prices.",
              },
              {
                num: 2,
                title: "Track your portfolio",
                desc: "Add your existing DSE holdings. We calculate P&L automatically using daily close prices.",
              },
              {
                num: 3,
                title: "Browser notifications",
                desc: "We'll alert you when your stops or targets hit — no need to check the app constantly.",
              },
            ].map((s) => (
              <div key={s.num} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white font-semibold text-sm flex items-center justify-center flex-shrink-0">
                  {s.num}
                </div>
                <div>
                  <div className="font-medium text-sm mb-0.5">{s.title}</div>
                  <div className="text-sm text-[var(--color-muted)]">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions — reduce clicks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <Link
            href="/onboarding"
            className="bg-white border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-medium text-sm mb-1">Set risk profile</div>
            <div className="text-xs text-[var(--color-muted)]">60 seconds · personalizes picks</div>
          </Link>
          <Link
            href="/portfolio"
            className="bg-white border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">💹</div>
            <div className="font-medium text-sm mb-1">Add holdings</div>
            <div className="text-xs text-[var(--color-muted)]">Track your DSE portfolio</div>
          </Link>
          <Link
            href="/track-record"
            className="bg-white border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium text-sm mb-1">See track record</div>
            <div className="text-xs text-[var(--color-muted)]">Past picks, hit rate, gains</div>
          </Link>
        </div>

        {/* Sample picks */}
        {samplePicks.length > 0 && (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)]">
              <div className="font-display font-semibold">Recent picks to get a feel</div>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Our last {samplePicks.length} resolved picks — this is what you'll receive daily
              </p>
            </div>
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {samplePicks.map((p: Record<string, unknown>, i: number) => {
                const positive = p.outcome === "target_hit";
                return (
                  <div key={i} className="px-6 py-3 flex items-center gap-4">
                    <Link href={`/stocks/${p.ticker}`} className="font-mono font-semibold text-sm text-[var(--color-primary)] min-w-[80px]">
                      {p.ticker as string}
                    </Link>
                    <div className="flex-1 text-xs text-[var(--color-muted)] font-bengali truncate">
                      {(p.reasoning_bn as string) ?? "—"}
                    </div>
                    <div className={`font-mono text-sm font-semibold tabular-nums ${
                      positive ? "text-[#16A34A]" : "text-[#DC2626]"
                    }`}>
                      {positive ? "+" : ""}{Number(p.gain_pct).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      {new Date(p.date as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock search invitation */}
        <div className="bg-gradient-to-br from-[rgba(0,102,204,0.04)] to-transparent border border-[rgba(0,102,204,0.15)] rounded-xl p-6 mb-6">
          <h3 className="font-display font-semibold mb-2">Explore any DSE stock</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Search 600+ DSE stocks by ticker or company name. Type <kbd className="text-[10px] bg-white border border-[var(--color-border)] rounded px-1.5 py-0.5 font-mono">/</kbd> anywhere to search fast.
          </p>
          <StockSearch placeholder="Try BEXIMCO, SQUAREPHARMA, BATBC..." />
        </div>

        <MarkOnboardedForm />

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Go to dashboard
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}

function MarkOnboardedForm() {
  return (
    <form
      action={async () => {
        "use server";
        const { getServerSession } = await import("next-auth");
        const { getDb } = await import("@/lib/postgres");
        const session = await getServerSession(authOptions);
        const uid = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
        if (uid) {
          const sql = getDb();
          await sql`UPDATE users SET onboarded_at = now() WHERE id = ${uid} AND onboarded_at IS NULL`;
        }
      }}
    />
  );
}
