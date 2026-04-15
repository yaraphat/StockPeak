import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";

// Returns basic stock info + current price + 52-week stats.
// Public endpoint (helps SEO). Full history is gated in the /history endpoint.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  const sql = getDb();

  try {
    const [stock] = await sql`
      SELECT ticker, company_name, company_name_bn, category, sector
      FROM dse_stocks WHERE ticker = ${ticker}
    `;
    if (!stock) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [latest] = await sql`
      SELECT date, close, volume, change_pct
      FROM stock_data
      WHERE ticker = ${ticker}
      ORDER BY date DESC
      LIMIT 1
    `;

    const [stats] = await sql`
      SELECT
        MAX(high) AS wk52_high,
        MIN(low) AS wk52_low,
        AVG(volume)::bigint AS avg_volume
      FROM stock_data
      WHERE ticker = ${ticker}
        AND date >= CURRENT_DATE - INTERVAL '52 weeks'
    `;

    return NextResponse.json({
      stock,
      latest: latest ?? null,
      stats: stats ?? null,
    });
  } catch (err) {
    console.error("Stock info error:", err);
    return NextResponse.json({ error: "Failed to load stock info" }, { status: 500 });
  }
}
