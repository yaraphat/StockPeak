import Link from "next/link";
import { getScorecard, getPickHistory } from "@/lib/db";
import { PickCard } from "@/components/pick-card";
import { Scorecard } from "@/components/scorecard";

export const dynamic = "force-dynamic";

export default async function TrackRecordPage() {
  let scorecard;
  let history;

  try {
    [scorecard, history] = await Promise.all([
      getScorecard(),
      getPickHistory(50),
    ]);
  } catch {
    return <TrackRecordPlaceholder />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
          <Link href="/dashboard" className="text-sm text-[var(--color-primary)] font-medium">Dashboard</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-2">Track Record</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6 font-bengali">
          প্রতিটি পিকের ফলাফল স্বয়ংক্রিয়ভাবে ট্র্যাক করা হয়। সম্পূর্ণ স্বচ্ছতা।
        </p>

        {scorecard.total_picks > 0 && (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
            <Scorecard data={scorecard} />
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--color-border-subtle)] text-center">
              <div>
                <div className="font-mono text-lg font-medium text-[var(--color-danger)] tabular-nums">
                  {scorecard.avg_loss.toFixed(1)}%
                </div>
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Avg Loss</div>
              </div>
              <div>
                <div className="font-mono text-lg font-medium tabular-nums">
                  {scorecard.open_picks}
                </div>
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Open Picks</div>
              </div>
            </div>
          </div>
        )}

        <h2 className="font-display text-lg font-semibold mb-4">Pick History</h2>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((pick) => (
              <PickCard
                key={pick.id}
                pick={pick}
                outcome={pick.outcome}
                showReasoning={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-muted)] text-sm font-bengali">
            এখনও কোনো পিক প্রকাশিত হয়নি।
          </p>
        )}
      </main>
    </div>
  );
}

function TrackRecordPlaceholder() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-8 text-center">
        <h1 className="font-display text-2xl font-bold mb-4">Track Record</h1>
        <p className="text-[var(--color-muted)] font-bengali">ডেটাবেস কনফিগার করা হয়নি অথবা এখনও কোনো পিক প্রকাশিত হয়নি।</p>
      </main>
    </div>
  );
}
