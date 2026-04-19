import type { Scorecard as ScorecardType } from "@/lib/types";
import { InfoTip } from "./info-tip";

export function Scorecard({ data }: { data: ScorecardType }) {
  const gainColor =
    data.avg_gain > 0 ? "text-[var(--color-success)]" : data.avg_gain < 0 ? "text-[#DC2626]" : "";
  const gainSign = data.avg_gain > 0 ? "+" : "";
  return (
    <div className="p-4 bg-[var(--background)] rounded-lg grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="font-mono text-2xl font-medium text-[var(--color-success)] tabular-nums">
          {data.hit_rate.toFixed(0)}%
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Hit Rate <InfoTip term="hit_rate" />
        </div>
      </div>
      <div>
        <div className="font-mono text-2xl font-medium tabular-nums">{data.total_picks}</div>
        <div className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Total Picks <InfoTip term="total_picks" />
        </div>
      </div>
      <div>
        <div className={`font-mono text-2xl font-medium tabular-nums ${gainColor}`}>
          {gainSign}
          {data.avg_gain.toFixed(1)}%
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] uppercase tracking-wider">
          Avg Gain <InfoTip term="avg_gain" />
        </div>
      </div>
    </div>
  );
}
