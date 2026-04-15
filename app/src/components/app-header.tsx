"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { StockSearch } from "./stock-search";
import { NotificationBell } from "./notification-bell";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  riskTier?: string | null;
  accessStatus?: "subscribed" | "trial" | "grace" | "expired" | null;
  trialDaysRemaining?: number | null;
}

export function AppHeader({ userName, userEmail, riskTier, accessStatus, trialDaysRemaining }: Props) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/track-record", label: "Track Record" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
        <Link href="/dashboard" className="font-display font-semibold text-lg tracking-tight flex-shrink-0">
          Stock Peak
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                pathname?.startsWith(l.href)
                  ? "text-[var(--color-primary)] bg-[rgba(0,102,204,0.06)] font-medium"
                  : "text-[var(--color-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 flex justify-center">
          <StockSearch compact />
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {accessStatus === "trial" && trialDaysRemaining != null && trialDaysRemaining > 0 && (
            <Link
              href="/subscribe"
              className={`hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                trialDaysRemaining <= 2
                  ? "bg-[#D97706] text-white"
                  : "bg-[var(--background)] text-[var(--color-muted)] border border-[var(--color-border)]"
              }`}
            >
              {trialDaysRemaining}d trial left
            </Link>
          )}
          {accessStatus === "subscribed" && (
            <span className="hidden sm:inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(22,163,74,0.1)] text-[#16A34A]">
              Pro
            </span>
          )}
          <NotificationBell />
          <UserMenu userName={userName} userEmail={userEmail} riskTier={riskTier} />
        </div>
      </div>
    </header>
  );
}

function UserMenu({ userName, userEmail, riskTier }: { userName?: string | null; userEmail?: string | null; riskTier?: string | null }) {
  const initial = (userName || userEmail || "U").charAt(0).toUpperCase();
  return (
    <div className="relative group">
      <button
        className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066CC] to-[#0052A3] text-white font-medium text-sm flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="User menu"
      >
        {initial}
      </button>
      <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-48 bg-white border border-[var(--color-border)] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
          <div className="text-sm font-medium text-[var(--foreground)] truncate">{userName || "User"}</div>
          <div className="text-xs text-[var(--color-muted)] truncate">{userEmail}</div>
          {riskTier && (
            <div className="text-[11px] mt-1 inline-block bg-[var(--background)] px-1.5 py-0.5 rounded text-[var(--color-muted)]">
              {riskTier.charAt(0).toUpperCase() + riskTier.slice(1)} investor
            </div>
          )}
        </div>
        <div className="py-1">
          <Link href="/onboarding" className="block px-4 py-2 text-sm hover:bg-[var(--background)] transition-colors">Profile</Link>
          <Link href="/subscribe" className="block px-4 py-2 text-sm hover:bg-[var(--background)] transition-colors">Subscription</Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left px-4 py-2 text-sm text-[#DC2626] hover:bg-[var(--background)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
