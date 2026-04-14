import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const date = req.nextUrl.searchParams.get("date");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 100);
  const sql = getDb();

  const rows = date
    ? await sql`
        SELECT
          p.*, po.outcome, po.exit_price, po.exit_date, po.gain_pct
        FROM picks p
        LEFT JOIN pick_outcomes po ON p.id = po.pick_id
        WHERE p.date = ${date}
        ORDER BY p.confidence DESC
      `
    : await sql`
        SELECT
          p.*, po.outcome, po.exit_price, po.exit_date, po.gain_pct
        FROM picks p
        LEFT JOIN pick_outcomes po ON p.id = po.pick_id
        ORDER BY p.date DESC, p.confidence DESC
        LIMIT ${limit}
      `;

  return NextResponse.json({ picks: rows });
}
