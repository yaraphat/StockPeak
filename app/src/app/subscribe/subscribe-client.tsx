"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Props {
  bkashNumber: string;
  nagadNumber: string;
  userPhone: string | null;
  accessStatus: string;
  subExpiresAt: string | null;
}

const PRICE = 260;

export function SubscribeClient({ bkashNumber, nagadNumber, userPhone, accessStatus, subExpiresAt }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [provider, setProvider] = useState<"bkash" | "nagad">("bkash");
  const [senderPhone, setSenderPhone] = useState(userPhone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "paid" | "expired" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  const merchantNumber = provider === "bkash" ? bkashNumber : nagadNumber;

  async function copyNumber() {
    await navigator.clipboard.writeText(merchantNumber.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, sender_phone: senderPhone, tier: "entry" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to record payment");
        setSubmitting(false);
        return;
      }
      setPendingId(data.pending_payment_id);
      setStatus("pending");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Poll payment status
  useEffect(() => {
    if (!pendingId || status !== "pending") return;

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/payments/status/${pendingId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid" || data.status === "manual_approved") {
            setStatus("paid");
            if (pollRef.current) clearInterval(pollRef.current);
            await update(); // force JWT refresh
            setTimeout(() => router.push("/dashboard"), 2000);
          } else if (data.status === "expired" || data.status === "rejected") {
            setStatus("expired");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        /* keep polling */
      }
      // Stop after 40 attempts (~6-7 min)
      if (attempts > 40) {
        setStatus("expired");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 10_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pendingId, status, update, router]);

  if (status === "paid") {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto bg-[#16A34A] rounded-full flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="font-display text-xl font-semibold mb-2">Payment confirmed ✓</h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">Your subscription is active. Redirecting...</p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto bg-[rgba(0,102,204,0.1)] rounded-full flex items-center justify-center mb-4">
          <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="font-display text-xl font-semibold mb-2">Verifying payment...</h2>
        <p className="text-sm text-[var(--color-muted)] mb-2">
          We're matching your {provider === "bkash" ? "bKash" : "Nagad"} transaction to your account.
        </p>
        <p className="text-xs text-[var(--color-muted)] font-bengali">
          সাধারণত ১-২ মিনিটের মধ্যে সম্পন্ন হয়। SMS পৌঁছালে আপনাকে স্বয়ংক্রিয়ভাবে নোটিফাই করা হবে।
        </p>
        <button
          onClick={() => { setStatus("idle"); setPendingId(null); }}
          className="mt-6 text-xs text-[var(--color-muted)] hover:text-[var(--foreground)] underline"
        >
          Cancel and try again
        </button>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold mb-2">Payment not detected</h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          We couldn't match your payment within the time window. This usually means:
        </p>
        <ul className="text-sm text-[var(--color-muted)] list-disc list-inside mb-4 space-y-1">
          <li>The sender phone number doesn't match</li>
          <li>The amount sent differs from ৳{PRICE}</li>
          <li>SMS delivery is delayed</li>
        </ul>
        <button
          onClick={() => { setStatus("idle"); setPendingId(null); }}
          className="bg-[var(--color-primary)] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)]"
        >
          Try again
        </button>
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Still having trouble? Message us on WhatsApp: {bkashNumber}
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden relative"
      style={{
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 24px 48px rgba(0,102,204,0.04)",
      }}
    >
      {/* Top glossy accent */}
      <div className="h-1 bg-gradient-to-r from-[#0066CC] via-[#0052A3] to-[#0066CC]" />

      {/* Subscription status header */}
      {accessStatus === "subscribed" && subExpiresAt && (
        <div
          className="border-b border-[rgba(22,163,74,0.2)] px-6 py-3"
          style={{ background: "linear-gradient(90deg, rgba(22,163,74,0.08) 0%, rgba(22,163,74,0.02) 100%)" }}
        >
          <div className="text-sm flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
            </span>
            <span className="font-semibold text-[#16A34A]">Active subscription</span>
            <span className="text-[var(--color-muted)]">
              · expires {new Date(subExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-0.5 font-bengali ml-4">
            নিচের ধাপে আরও ৩০ দিন যোগ করুন
          </p>
        </div>
      )}

      {/* Price — with subtle radial glow */}
      <div className="relative text-center py-8 border-b border-[var(--color-border-subtle)] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center top, rgba(0,102,204,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative">
          <div
            className="font-display text-6xl font-bold tabular-nums"
            style={{
              background: "linear-gradient(180deg, #1C1917 0%, #44403C 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ৳{PRICE}
          </div>
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-widest mt-2">per month · 30 days access</div>
        </div>
      </div>

      {/* Step 1: choose provider */}
      <div className="p-6 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold flex items-center justify-center">1</span>
          <span className="font-medium text-sm">Choose payment method</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "bkash" as const, name: "bKash", color: "#E2136E", tint: "rgba(226,19,110,0.04)" },
            { id: "nagad" as const, name: "Nagad", color: "#EA7020", tint: "rgba(234,112,32,0.04)" },
          ].map((p) => {
            const active = provider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`group p-4 rounded-xl transition-all text-left relative overflow-hidden ${
                  active ? "-translate-y-0.5" : "hover:-translate-y-0.5"
                }`}
                style={{
                  border: `2px solid ${active ? p.color : "var(--color-border)"}`,
                  background: active
                    ? `linear-gradient(135deg, ${p.tint} 0%, rgba(255,255,255,0.5) 100%)`
                    : "#ffffff",
                  boxShadow: active
                    ? `0 4px 12px ${p.tint.replace("0.04", "0.15")}`
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {active && (
                  <svg
                    className="absolute top-3 right-3"
                    width="18" height="18" viewBox="0 0 24 24" fill={p.color}
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
                <div className="font-bold text-xl" style={{ color: p.color }}>{p.name}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">Send from your app</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: send money */}
      <div className="p-6 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold flex items-center justify-center">2</span>
          <span className="font-medium text-sm">Send ৳{PRICE} via {provider === "bkash" ? "bKash" : "Nagad"} "Send Money"</span>
        </div>
        <div className="bg-[var(--background)] border border-[var(--color-border)] rounded-lg p-4 mb-3">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
            {provider === "bkash" ? "bKash" : "Nagad"} number
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xl font-semibold tabular-nums select-all">
              {merchantNumber}
            </span>
            <button
              onClick={copyNumber}
              className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] px-3 py-1.5 border border-[var(--color-border)] rounded-md bg-white"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)] font-bengali">
          আপনার {provider === "bkash" ? "bKash" : "Nagad"} অ্যাপ খুলুন → Send Money → উপরের নাম্বারে ৳{PRICE} পাঠান
        </p>
      </div>

      {/* Step 3: confirm with phone */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold flex items-center justify-center">3</span>
          <span className="font-medium text-sm">Enter the phone you sent from, then confirm</span>
        </div>
        <input
          type="tel"
          value={senderPhone}
          onChange={(e) => setSenderPhone(e.target.value)}
          placeholder="01XXXXXXXXX"
          className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg font-mono text-sm mb-3 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
        {error && (
          <div className="text-xs text-[#DC2626] mb-3">{error}</div>
        )}
        <button
          onClick={handleConfirm}
          disabled={submitting || !senderPhone.trim()}
          className="w-full text-white font-semibold text-sm py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_8px_24px_rgba(0,102,204,0.3)] hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          style={{
            background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)",
            boxShadow: "0 2px 4px rgba(0,102,204,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {submitting ? "Confirming..." : `I've sent ৳${PRICE} — verify and activate`}
        </button>
        <p className="text-[11px] text-[var(--color-muted)] mt-3 text-center">
          We verify via SMS from {provider === "bkash" ? "bKash" : "Nagad"}. Usually takes 1-2 minutes.
        </p>
      </div>
    </div>
  );
}
