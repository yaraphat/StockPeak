"use client";

import Link from "next/link";

interface Props {
  hasCompletedQuestionnaire: boolean;
  riskTier?: string | null;
}

const TIER_CONFIG: Record<string, { label: string; label_bn: string; color: string }> = {
  conservative: { label: "Conservative", label_bn: "রক্ষণশীল", color: "#0066CC" },
  moderate: { label: "Moderate", label_bn: "মধ্যম", color: "#D97706" },
  aggressive: { label: "Aggressive", label_bn: "আক্রমণাত্মক", color: "#DC2626" },
};

export function RiskProfileBadge({ riskTier }: { riskTier: string }) {
  const config = TIER_CONFIG[riskTier] || TIER_CONFIG.moderate;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
      style={{ backgroundColor: config.color }}
      title={`Risk profile: ${config.label}`}
    >
      {config.label_bn}
    </span>
  );
}

export function RiskProfileBanner({ hasCompletedQuestionnaire, riskTier }: Props) {
  if (hasCompletedQuestionnaire) return null;

  return (
    <div className="mx-4 mt-4 p-3 bg-[rgba(0,102,204,0.06)] border border-[rgba(0,102,204,0.15)] rounded-lg flex items-center justify-between gap-3">
      <p className="text-sm text-[#1C1917]">
        <span className="font-bengali">আপনার বিনিয়োগ প্রোফাইল তৈরি করুন</span>{" "}
        <span className="text-[#78716C] text-xs">— ৬০ সেকেন্ডের কুইজ, ব্যক্তিগত পিক পান</span>
      </p>
      <Link
        href="/onboarding"
        className="shrink-0 text-xs font-semibold text-[#0066CC] hover:underline"
      >
        শুরু করুন →
      </Link>
    </div>
  );
}
