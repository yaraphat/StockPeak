import type { Scorecard as ScorecardType } from "@/lib/types";

export function Scorecard({ data }: { data: ScorecardType }) {
  return (
    <div className="p-4 bg-[var(--background)] rounded-lg grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="font-mono text-2xl font-medium text-[var(--color-success)] tabular-nums">
          {data.hit_rate.toFixed(0)}%
        </div>
        <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Hit Rate
        </div>
      </div>
      <div>
        <div className="font-mono text-2xl font-medium tabular-nums">
          {data.total_picks}
        </div>
        <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Total Picks
        </div>
      </div>
      <div>
        <div className="font-mono text-2xl font-medium text-[var(--color-success)] tabular-nums">
          +{data.avg_gain.toFixed(1)}%
        </div>
        <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Avg Gain
        </div>
      </div>
    </div>
  );
}
