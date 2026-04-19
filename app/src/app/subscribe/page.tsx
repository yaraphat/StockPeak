import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAccess } from "@/lib/access";
import { getDb } from "@/lib/postgres";
import { AppHeader } from "@/components/app-header";
import { SubscribeClient } from "./subscribe-client";

export const dynamic = "force-dynamic";

const BKASH_MERCHANT_NUMBER = process.env.BKASH_PERSONAL_NUMBER ?? "01XXXXXXXXX";
const NAGAD_MERCHANT_NUMBER = process.env.NAGAD_PERSONAL_NUMBER ?? "01XXXXXXXXX";

export default async function SubscribePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) redirect("/login?callbackUrl=/subscribe");

  const access = await getUserAccess(user.id as string);
  const sql = getDb();
  const [profile] = await sql`
    SELECT phone, name FROM users WHERE id = ${user.id as string}
  `;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader
        userName={user.name as string | null}
        userEmail={user.email as string | null}
        accessStatus={access?.accessStatus ?? null}
        trialDaysRemaining={access?.trialDaysRemaining ?? null}
        currentTier={access?.currentTier ?? null}
      />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold mb-2">Upgrade to Pro</h1>
          <p className="text-[var(--color-muted)] font-bengali">
            দৈনিক ৩টি AI পিক + পোর্টফোলিও ট্র্যাকিং + স্টক চার্ট
          </p>
        </div>

        <SubscribeClient
          bkashNumber={BKASH_MERCHANT_NUMBER}
          nagadNumber={NAGAD_MERCHANT_NUMBER}
          userPhone={(profile?.phone as string | null) ?? null}
          accessStatus={access?.accessStatus ?? "expired"}
          subExpiresAt={access?.subscriptionExpiresAt?.toISOString() ?? null}
        />

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "📊", title: "3 daily picks", desc: "AI-analyzed DSE stocks every trading day with entry, target, stop" },
            { icon: "💹", title: "Portfolio P&L", desc: "Track your gains and losses automatically as prices update" },
            { icon: "🔔", title: "Real-time alerts", desc: "Browser notifications when your stops or targets hit" },
          ].map((f) => (
            <div key={f.title} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-[var(--color-muted)]">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[var(--color-muted)] mt-8 font-bengali">
          শিক্ষামূলক AI বিশ্লেষণ, বিনিয়োগ পরামর্শ নয়। বাজারের ঝুঁকি সম্পর্কে সচেতন থাকুন।
        </p>
      </main>
    </div>
  );
}
