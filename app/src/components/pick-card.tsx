import type { Pick, PickOutcome } from "@/lib/types";

function confidenceLabel(c: number) {
  if (c >= 7) return "High Confidence";
  if (c >= 4) return "Moderate";
  return "Speculative";
}

function outcomeTag(outcome?: PickOutcome) {
  if (!outcome || outcome.outcome === "open") return null;
  const styles = {
    target_hit: "bg-green-50 text-green-700 border-green-200",
    stop_hit: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const labels = {
    target_hit: `Target Hit +${outcome.gain_pct?.toFixed(1)}%`,
    stop_hit: `Stop Hit ${outcome.gain_pct?.toFixed(1)}%`,
    expired: "Expired",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded border ${styles[outcome.outcome]}`}
    >
      {labels[outcome.outcome]}
    </span>
  );
}

export function PickCard({
  pick,
  outcome,
  showReasoning = true,
}: {
  pick: Pick;
  outcome?: PickOutcome;
  showReasoning?: boolean;
}) {
  const gainPct = (((pick.target - pick.buy_zone) / pick.buy_zone) * 100).toFixed(1);

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[var(--color-primary)] font-medium text-sm">
              {pick.ticker}
            </span>
            {outcomeTag(outcome)}
          </div>
          <p className="font-bengali text-xs text-[var(--color-muted)]">
            {pick.company_name_bn}
          </p>
        </div>
        <div className="text-right font-mono tabular-nums text-sm">
          <div className="font-medium">৳{pick.buy_zone.toFixed(2)}</div>
          <div className="text-xs text-[var(--color-muted)]">
            Target: ৳{pick.target.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
        <span className="text-[var(--color-success)] font-semibold text-sm">
          +{gainPct}% upside
        </span>
        <span className="text-xs text-[var(--color-muted)] font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
          {pick.confidence}/10 {confidenceLabel(pick.confidence)}
        </span>
      </div>
      {showReasoning && pick.reasoning_bn && (
        <p className="font-bengali text-sm text-[var(--color-muted)] leading-relaxed mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          {pick.reasoning_bn}
        </p>
      )}
    </div>
  );
}
