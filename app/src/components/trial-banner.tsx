"use client";

import Link from "next/link";

interface Props {
  daysRemaining: number;
  variant?: "banner" | "inline";
}

export function TrialBanner({ daysRemaining, variant = "banner" }: Props) {
  if (daysRemaining <= 0) return null;

  const urgent = daysRemaining <= 2;
  const bg = urgent ? "#D97706" : "#0066CC";

  if (variant === "inline") {
    return (
      <Link
        href="/subscribe"
        className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
        style={{ background: bg, color: "#FFF" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left → Subscribe ৳260
      </Link>
    );
  }

  return (
    <div
      className="border rounded-xl p-4 flex items-center gap-4"
      style={{
        background: urgent ? "rgba(217,119,6,0.06)" : "rgba(0,102,204,0.04)",
        borderColor: urgent ? "rgba(217,119,6,0.3)" : "rgba(0,102,204,0.2)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: bg, color: "#FFF" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {urgent ? `Trial ending in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}` : `${daysRemaining} days left on your trial`}
        </div>
        <div className="text-xs text-[var(--color-muted)] font-bengali">
          ৳২৬০/মাসে সাবস্ক্রাইব করুন এবং প্রতিদিন ৩টি AI পিক + পোর্টফোলিও ট্র্যাকিং অব্যাহত রাখুন
        </div>
      </div>
      <Link
        href="/subscribe"
        className="text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
        style={{ background: bg, color: "#FFF" }}
      >
        Subscribe →
      </Link>
    </div>
  );
}
