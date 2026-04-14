"use client";

import { useEffect, useState } from "react";

type Proposal = {
  id: string;
  skill_name: string;
  proposal_type: string;
  evidence_summary: string;
  current_text: string;
  proposed_text: string;
  reasoning: string;
  sample_size: number;
  status: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export default function SkillProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/skill-proposals?filter=${filter}`);
      if (!res.ok) throw new Error(await res.text());
      setProposals(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, action: "approved" | "rejected" | "deferred") {
    setReviewing(id);
    try {
      const res = await fetch(`/api/admin/skill-proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, review_note: notes[id] ?? "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      alert(`Failed: ${e}`);
    } finally {
      setReviewing(null);
    }
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const reviewed = proposals.filter((p) => p.status !== "pending");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px", fontFamily: "Plus Jakarta Sans, sans-serif", color: "#1C1917" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
          Skill Proposals
        </h1>
        <p style={{ marginTop: 8, color: "#78716C", fontSize: 14 }}>
          Claude's proposed prompt changes based on pick performance data.
          Approve to apply, reject to discard, defer to revisit later.
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => setFilter("pending")}
            style={tabStyle(filter === "pending")}
          >
            Pending ({pending.length})
          </button>
          <button
            onClick={() => setFilter("all")}
            style={tabStyle(filter === "all")}
          >
            All
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#78716C" }}>Loading...</p>}
      {error && <p style={{ color: "#DC2626" }}>{error}</p>}

      {!loading && proposals.length === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#78716C", borderTop: "1px solid #E7E5E4" }}>
          <p style={{ fontSize: 15 }}>No {filter === "pending" ? "pending " : ""}proposals.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            The feedback compiler needs ≥30 resolved picks to generate proposals.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {proposals.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #E7E5E4",
              borderRadius: 8,
              background: "#FFFFFF",
              overflow: "hidden",
              opacity: p.status !== "pending" ? 0.7 : 1,
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E7E5E4", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: "Geist Mono, monospace", background: "#F8F6F4", border: "1px solid #E7E5E4", borderRadius: 4, padding: "2px 6px", color: "#78716C" }}>
                    {p.skill_name}
                  </span>
                  <span style={{ fontSize: 12, color: "#78716C" }}>{p.proposal_type.replace("_", " ")}</span>
                  <span style={{ fontSize: 12, color: "#78716C" }}>·</span>
                  <span style={{ fontSize: 12, color: "#78716C" }}>{p.sample_size} picks analysed</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "#1C1917", lineHeight: 1.5 }}>
                  <strong>Evidence:</strong> {p.evidence_summary}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>

            {/* Reasoning */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E7E5E4", background: "#F8F6F4" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#1C1917", lineHeight: 1.6 }}>
                <strong>Reasoning:</strong> {p.reasoning}
              </p>
            </div>

            {/* Diff */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E7E5E4" }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#78716C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Proposed change
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#DC2626", fontWeight: 600 }}>CURRENT</p>
                  <pre style={codeStyle("#FFF5F5", "#DC2626")}>{p.current_text}</pre>
                </div>
                <div>
                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#16A34A", fontWeight: 600 }}>PROPOSED</p>
                  <pre style={codeStyle("#F0FDF4", "#16A34A")}>{p.proposed_text}</pre>
                </div>
              </div>
            </div>

            {/* Actions (only for pending) */}
            {p.status === "pending" && (
              <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Optional review note..."
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #E7E5E4", borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
                <button
                  onClick={() => act(p.id, "approved")}
                  disabled={reviewing === p.id}
                  style={actionBtn("#16A34A")}
                >
                  {reviewing === p.id ? "..." : "Approve"}
                </button>
                <button
                  onClick={() => act(p.id, "deferred")}
                  disabled={reviewing === p.id}
                  style={actionBtn("#D97706")}
                >
                  Defer
                </button>
                <button
                  onClick={() => act(p.id, "rejected")}
                  disabled={reviewing === p.id}
                  style={actionBtn("#DC2626")}
                >
                  Reject
                </button>
              </div>
            )}

            {/* Review note (reviewed proposals) */}
            {p.status !== "pending" && p.review_note && (
              <div style={{ padding: "10px 20px", background: "#F8F6F4", fontSize: 13, color: "#78716C" }}>
                Note: {p.review_note}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: "8px 20px", background: "#F8F6F4", borderTop: "1px solid #E7E5E4", fontSize: 11, color: "#78716C", display: "flex", gap: 16 }}>
              <span>Created {new Date(p.created_at).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</span>
              {p.reviewed_at && (
                <span>Reviewed {new Date(p.reviewed_at).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    pending:  { bg: "#FEF3C7", color: "#D97706" },
    approved: { bg: "#DCFCE7", color: "#16A34A" },
    rejected: { bg: "#FEE2E2", color: "#DC2626" },
    deferred: { bg: "#F1F5F9", color: "#64748B" },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, padding: "3px 8px", borderRadius: 9999, background: c.bg, color: c.color, whiteSpace: "nowrap", flexShrink: 0 }}>
      {status}
    </span>
  );
}

function tabStyle(active: boolean) {
  return {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    border: "1px solid " + (active ? "#0066CC" : "#E7E5E4"),
    borderRadius: 6,
    background: active ? "#0066CC" : "#FFFFFF",
    color: active ? "#FFFFFF" : "#78716C",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties;
}

function codeStyle(bg: string, borderColor: string) {
  return {
    margin: 0,
    padding: "10px 12px",
    background: bg,
    border: `1px solid ${borderColor}22`,
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "Geist Mono, monospace",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    overflowX: "auto" as const,
    color: "#1C1917",
  };
}

function actionBtn(color: string) {
  return {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    border: `1px solid ${color}`,
    borderRadius: 6,
    background: color,
    color: "#FFFFFF",
    cursor: "pointer",
    fontFamily: "inherit",
  } as React.CSSProperties;
}
