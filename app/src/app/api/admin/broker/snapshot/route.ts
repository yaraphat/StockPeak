import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT
      id, snapshot_date, market_summary, stock_count, source, captured_at
    FROM dse_daily_snapshots
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ snapshot: null });
  }

  return NextResponse.json({ snapshot: rows[0] });
}
