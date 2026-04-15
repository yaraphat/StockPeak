"use client";

import Link from "next/link";

export function PaywallOverlay({ message }: { message?: string }) {
  return (
    <div className="relative min-h-[400px] flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.95) 40%)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div className="relative z-10 bg-white border border-[var(--color-border)] rounded-xl p-8 max-w-md text-center shadow-lg">
        <div className="w-14 h-14 mx-auto bg-gradient-to-br from-[#0066CC] to-[#0052A3] rounded-full flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <h2 className="font-display text-xl font-semibold mb-2">
          {message ?? "Subscribe to continue"}
        </h2>
        <p className="text-sm text-[var(--color-muted)] font-bengali mb-6">
          আপনার ট্রায়াল শেষ। ৳২৬০/মাসে সাবস্ক্রাইব করুন এবং দৈনিক ৩টি পিক পেতে থাকুন।
        </p>
        <Link
          href="/subscribe"
          className="inline-flex items-center gap-2 w-full justify-center bg-[var(--color-primary)] text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Subscribe — ৳260/month
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
        <p className="text-[11px] text-[var(--color-muted)] mt-4">
          bKash / Nagad accepted. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
