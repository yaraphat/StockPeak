const moodConfig = {
  bullish: { color: "var(--color-success)", bg: "rgba(22,163,74,0.06)", label: "Bullish" },
  neutral: { color: "var(--color-muted)", bg: "rgba(120,113,108,0.06)", label: "Neutral" },
  bearish: { color: "var(--color-danger)", bg: "rgba(220,38,38,0.06)", label: "Bearish" },
};

export function MarketMood({
  mood,
  reason,
}: {
  mood: "bullish" | "neutral" | "bearish";
  reason: string;
}) {
  const cfg = moodConfig[mood];
  return (
    <div
      className="flex items-center gap-3 px-6 py-3 border-b border-[var(--color-border)]"
      style={{ background: cfg.bg }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: cfg.color }}
      />
      <span className="font-semibold text-sm" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
      <span className="text-sm text-[var(--color-muted)]">{reason}</span>
    </div>
  );
}
