import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const sql = getDb();

  // Get today's pre-computed snapshot (computed daily by pipeline)
  const today = new Date().toISOString().split("T")[0];
  const snapshots = await sql`
    SELECT
      snapshot_date,
      total_value,
      daily_pnl,
      var_95_pct,
      var_95_amount,
      max_drawdown_pct,
      peak_value,
      correlation_matrix,
      holdings_snapshot,
      computed_at
    FROM portfolio_snapshots
    WHERE user_id = ${userId}
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  if (snapshots.length === 0) {
    return NextResponse.json({
      snapshot_date: null,
      total_value: null,
      daily_pnl: null,
      var_95_pct: null,
      var_95_amount: null,
      max_drawdown_pct: null,
      peak_value: null,
      correlation_matrix: null,
      holdings_snapshot: null,
      computed_at: null,
      message: "No portfolio intelligence data yet. Add holdings and check back after market close.",
      alerts: [],
    });
  }

  const snap = snapshots[0];

  // Get recent unacknowledged alerts for this user
  const alerts = await sql`
    SELECT id, alert_type, ticker, severity, message, delivered_at
    FROM alerts_log
    WHERE user_id = ${userId}
      AND acknowledged_at IS NULL
      AND delivered_at > now() - interval '7 days'
    ORDER BY delivered_at DESC
    LIMIT 20
  `;

  // Build drawdown advisory
  const drawdown = snap.max_drawdown_pct !== null ? Number(snap.max_drawdown_pct) : null;
  let drawdown_advisory: string | null = null;
  if (drawdown !== null) {
    if (drawdown <= -20) {
      drawdown_advisory = "DEFENSIVE POSTURE: Portfolio down " + Math.abs(drawdown).toFixed(1) + "% from peak. Consider reducing equity exposure significantly.";
    } else if (drawdown <= -15) {
      drawdown_advisory = "CAUTION: Portfolio down " + Math.abs(drawdown).toFixed(1) + "% from peak. Consider reducing equity exposure by 25%.";
    } else if (drawdown <= -10) {
      drawdown_advisory = "ALERT: Portfolio down " + Math.abs(drawdown).toFixed(1) + "% from peak. Review and tighten stop-losses.";
    }
  }

  return NextResponse.json({
    snapshot_date: snap.snapshot_date,
    total_value: snap.total_value !== null ? Number(snap.total_value) : null,
    daily_pnl: snap.daily_pnl !== null ? Number(snap.daily_pnl) : null,
    var_95_pct: snap.var_95_pct !== null ? Number(snap.var_95_pct) : null,
    var_95_amount: snap.var_95_amount !== null ? Number(snap.var_95_amount) : null,
    max_drawdown_pct: drawdown,
    peak_value: snap.peak_value !== null ? Number(snap.peak_value) : null,
    correlation_matrix: snap.correlation_matrix,
    holdings_snapshot: snap.holdings_snapshot,
    computed_at: snap.computed_at,
    drawdown_advisory,
    alerts,
    is_stale: snap.snapshot_date < today,
  });
}
