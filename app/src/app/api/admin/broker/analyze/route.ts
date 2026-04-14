import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runScript } from "@/lib/spawn";

/**
 * POST /api/admin/broker/analyze
 *
 * Runs broker_agent.py — scrapes DSE live data, computes RSI/MACD/Bollinger for
 * all liquid stocks, classifies by risk tier, writes report to
 * /tmp/stockpeak-broker-report.json and stores to dse_daily_snapshots.
 *
 * Body (optional JSON):
 *   { "no_history": true }  — skip historical data fetch (faster, ~30s vs ~10min)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let noHistory = false;
  try {
    const body = await req.json();
    noHistory = Boolean(body?.no_history);
  } catch { /* body optional */ }

  const args = noHistory ? ["--no-history"] : [];

  try {
    const { stdout, stderr } = await runScript("broker_agent.py", args, 900_000);
    return NextResponse.json({
      ok: true,
      output: stderr || stdout,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
