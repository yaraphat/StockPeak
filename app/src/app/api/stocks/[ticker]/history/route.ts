import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";
import { getUserAccess, hasActiveAccess } from "@/lib/access";

const MAX_DAYS_UNAUTH = 180; // 6 months — enough to show trend + conversion value
const MAX_DAYS_PAID = 730; // 2 years

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "90");
  const daysRequested = Math.max(1, Math.min(daysParam, MAX_DAYS_PAID));

  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined;

  // Access gate — unauth users see last 30 days only
  let daysAllowed = MAX_DAYS_UNAUTH;
  let gated = false;
  if (userId) {
    const access = await getUserAccess(userId);
    if (hasActiveAccess(access)) {
      daysAllowed = MAX_DAYS_PAID;
    } else {
      daysAllowed = MAX_DAYS_UNAUTH;
      gated = true;
    }
  } else {
    gated = true;
  }

  const days = Math.min(daysRequested, daysAllowed);

  const sql = getDb();

  try {
    const rows = await sql`
      SELECT date, open, high, low, close, volume, change_pct
      FROM stock_data
      WHERE ticker = ${ticker}
        AND date >= CURRENT_DATE - (${days}::int || ' days')::interval
      ORDER BY date ASC
    `;

    return NextResponse.json({
      ticker,
      days: rows.length,
      daysRequested,
      daysAllowed,
      gated: gated && daysRequested > daysAllowed,
      data: rows,
    });
  } catch (err) {
    console.error("Stock history error:", err);
    return NextResponse.json({ ticker, days: 0, data: [], gated, error: "Failed to load" });
  }
}
