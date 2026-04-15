"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  ticker: string | null;
  data: Record<string, unknown>;
  severity: string;
  read_at: string | null;
  created_at: string;
}

interface ApiResponse {
  notifications: Notification[];
  total: number;
  unread: number;
}

const SEVERITY_BAR: Record<string, string> = {
  emergency: "#DC2626",
  critical:  "#DC2626",
  warning:   "#D97706",
  info:      "#0066CC",
};

const TYPE_LABEL: Record<string, string> = {
  exceptional_opportunity: "Exceptional Opportunity",
  intraday_opportunity:    "Intraday Opportunity",
  daily_picks:             "Daily Picks",
  pre_market_brief:        "Pre-Market Brief",
  eod_summary:             "EOD Summary",
  weekly_digest:           "Weekly Digest",
  stop_loss_hit:           "Stop Loss Hit",
  approaching_stop:        "Approaching Stop",
  target_hit:              "Target Hit",
  price_move_5pct:         "Price Move ≥5%",
};

const SEVERITY_ICON: Record<string, string> = {
  emergency: "🚨",
  critical:  "🚨",
  warning:   "⚠️",
  info:      "📊",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDay(items: Notification[]): [string, Notification[]][] {
  const map = new Map<string, Notification[]>();
  for (const n of items) {
    const day = new Date(n.created_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(n);
  }
  return Array.from(map.entries());
}

export default function NotificationsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${LIMIT}&offset=${offset}`, { credentials: "include" });
      const json: ApiResponse = await res.json();
      setData(json);
      setPage(offset / LIMIT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setData((prev) => prev ? {
      ...prev,
      unread: Math.max(0, prev.unread - 1),
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ),
    } : null);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setData((prev) => prev ? {
      ...prev,
      unread: 0,
      notifications: prev.notifications.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
    } : null);
  }

  const groups = groupByDay(data?.notifications ?? []);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F6F4" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid #E7E5E4",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/dashboard" style={{ color: "#78716C", fontSize: 13, textDecoration: "none" }}>
              ← Dashboard
            </Link>
            <span style={{ color: "#E7E5E4" }}>|</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Notifications</span>
            {(data?.unread ?? 0) > 0 && (
              <span style={{
                background: "#DC2626",
                color: "#fff",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 7px",
              }}>
                {data!.unread}
              </span>
            )}
          </div>
          {(data?.unread ?? 0) > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: "none",
                border: "1px solid #E7E5E4",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                color: "#0066CC",
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </nav>

      {/* Body */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 64px" }}>
        {loading && data === null ? (
          <div style={{ textAlign: "center", padding: 48, color: "#78716C", fontSize: 14 }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{
            background: "#fff",
            border: "1px solid #E7E5E4",
            borderRadius: 12,
            padding: 48,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
            <p style={{ color: "#78716C", fontSize: 14, fontFamily: "inherit" }}>
              No notifications yet. You&apos;ll see alerts here when the market moves.
            </p>
          </div>
        ) : (
          <>
            {groups.map(([day, items]) => (
              <div key={day} style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#78716C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {day}
                </p>
                <div style={{
                  background: "#fff",
                  border: "1px solid #E7E5E4",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {items.map((n, i) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read_at && markRead(n.id)}
                      style={{
                        padding: "14px 16px 14px 20px",
                        borderBottom: i < items.length - 1 ? "1px solid #F5F5F4" : "none",
                        borderLeft: `3px solid ${SEVERITY_BAR[n.severity] ?? "#0066CC"}`,
                        background: n.read_at ? "transparent" : "rgba(0,102,204,0.03)",
                        cursor: n.read_at ? "default" : "pointer",
                        transition: "background 0.15s",
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>
                        {SEVERITY_ICON[n.severity] ?? "📢"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: n.read_at ? 500 : 600,
                            color: "#1C1917",
                            lineHeight: 1.3,
                          }}>
                            {n.title}
                          </span>
                          <span style={{ fontSize: 11, color: "#A8A29E", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#78716C", lineHeight: 1.5 }}>
                          {n.body}
                        </p>
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 11,
                            background: "#F5F5F4",
                            padding: "2px 8px",
                            borderRadius: 99,
                            color: "#78716C",
                          }}>
                            {TYPE_LABEL[n.type] ?? n.type}
                          </span>
                          {n.ticker && (
                            <span style={{
                              fontSize: 11,
                              background: "#EFF6FF",
                              color: "#0066CC",
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontFamily: "monospace",
                              fontWeight: 600,
                            }}>
                              {n.ticker}
                            </span>
                          )}
                          {!n.read_at && (
                            <span style={{
                              fontSize: 11,
                              background: "#DC2626",
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: 99,
                              fontWeight: 600,
                            }}>
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {data && data.total > LIMIT && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button
                  disabled={page === 0}
                  onClick={() => load((page - 1) * LIMIT)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #E7E5E4",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: page === 0 ? "default" : "pointer",
                    fontSize: 13,
                    color: page === 0 ? "#A8A29E" : "#1C1917",
                  }}
                >
                  ← Previous
                </button>
                <span style={{ padding: "8px 12px", fontSize: 13, color: "#78716C" }}>
                  {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, data.total)} of {data.total}
                </span>
                <button
                  disabled={(page + 1) * LIMIT >= data.total}
                  onClick={() => load((page + 1) * LIMIT)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #E7E5E4",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: (page + 1) * LIMIT >= data.total ? "default" : "pointer",
                    fontSize: 13,
                    color: (page + 1) * LIMIT >= data.total ? "#A8A29E" : "#1C1917",
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
