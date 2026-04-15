"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface NotifResponse {
  unread: number;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    ticker: string | null;
    severity: string;
    read_at: string | null;
    created_at: string;
  }>;
}

const POLL_INTERVAL = 30_000; // 30 s

// Severity → border-left color
const SEVERITY_COLOR: Record<string, string> = {
  emergency: "#DC2626",
  critical:  "#DC2626",
  warning:   "#D97706",
  info:      "#0066CC",
};

// Type → short label
const TYPE_LABEL: Record<string, string> = {
  exceptional_opportunity: "Exceptional",
  intraday_opportunity:    "Intraday",
  daily_picks:             "Daily Picks",
  pre_market_brief:        "Pre-Market",
  eod_summary:             "EOD",
  weekly_digest:           "Weekly",
  stop_loss_hit:           "Stop Loss",
  approaching_stop:        "Near Stop",
  target_hit:              "Target Hit",
  price_move_5pct:         "Price Move",
};

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifResponse["notifications"]>([]);
  const [loading, setLoading] = useState(false);
  const prevUnread = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=5", { credentials: "include" });
      if (!res.ok) return;
      const data: NotifResponse = await res.json();

      // Browser notification for new items
      if (data.unread > prevUnread.current && prevUnread.current !== 0) {
        const newest = data.notifications.find((n) => !n.read_at);
        if (newest && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(newest.title, {
            body: newest.body,
            icon: "/favicon.ico",
            tag: newest.id,
          });
        }
      }

      prevUnread.current = data.unread;
      setUnread(data.unread);
      if (open) setItems(data.notifications);
    } catch {
      // network error — ignore
    }
  }, [open]);

  // Initial load + polling
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Load preview items when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/notifications?limit=5", { credentials: "include" })
      .then((r) => r.json())
      .then((data: NotifResponse) => {
        setItems(data.notifications);
        setUnread(data.unread);
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        style={{
          position: "relative",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          color: "var(--color-muted)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "#DC2626",
            color: "#fff",
            borderRadius: "9999px",
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
          }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          width: 340,
          background: "var(--color-surface, #fff)",
          border: "1px solid var(--color-border, #E7E5E4)",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 100,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border, #E7E5E4)",
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Notifications {unread > 0 && <span style={{ color: "#DC2626", fontSize: 12 }}>({unread})</span>}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#0066CC" }}
                >
                  Mark all read
                </button>
              )}
              <Link
                href="/notifications"
                style={{ fontSize: 12, color: "#0066CC", textDecoration: "none" }}
                onClick={() => setOpen(false)}
              >
                See all
              </Link>
            </div>
          </div>

          {/* Items */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "#78716C", fontSize: 13 }}>Loading...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#78716C", fontSize: 13 }}>
                No notifications yet.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read_at && markRead(n.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--color-border, #E7E5E4)",
                    borderLeft: `3px solid ${SEVERITY_COLOR[n.severity] ?? "#0066CC"}`,
                    background: n.read_at ? "transparent" : "rgba(0,102,204,0.04)",
                    cursor: n.read_at ? "default" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1C1917" }}>{n.title}</span>
                    <span style={{
                      fontSize: 10,
                      background: "#F5F5F4",
                      padding: "1px 6px",
                      borderRadius: 99,
                      color: "#78716C",
                      whiteSpace: "nowrap",
                      marginLeft: 8,
                    }}>
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#78716C", lineHeight: 1.4 }}>
                    {n.body.length > 100 ? n.body.slice(0, 100) + "…" : n.body}
                  </p>
                  <span style={{ fontSize: 11, color: "#A8A29E", marginTop: 4, display: "block" }}>
                    {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
