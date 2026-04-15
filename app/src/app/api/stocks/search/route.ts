import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";
import { rateLimit } from "@/lib/rate-limit";

// Public endpoint — helps SEO + gives free value pre-signup.
// Rate-limited 60 req/min per IP to prevent abuse.
export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "10"), 20);

  const sql = getDb();

  try {
    if (!q) {
      // Empty query → return top 10 most active stocks from stock_data
      const rows = await sql`
        SELECT DISTINCT ON (ds.ticker)
          ds.ticker, ds.company_name, ds.company_name_bn, ds.category, ds.sector
        FROM dse_stocks ds
        WHERE ds.is_active = true
        ORDER BY ds.ticker ASC
        LIMIT ${limit}
      `;
      return NextResponse.json({ results: rows, query: q });
    }

    const rows = await sql`
      SELECT
        ticker, company_name, company_name_bn, category, sector,
        (CASE
          WHEN ticker ILIKE ${q + "%"} THEN 3
          WHEN ticker ILIKE ${"%" + q + "%"} THEN 2
          WHEN company_name ILIKE ${"%" + q + "%"} THEN 1
          WHEN company_name_bn ILIKE ${"%" + q + "%"} THEN 1
          ELSE similarity(ticker, ${q})
        END)::float AS score
      FROM dse_stocks
      WHERE is_active = true
        AND (
          ticker ILIKE ${"%" + q + "%"}
          OR company_name ILIKE ${"%" + q + "%"}
          OR company_name_bn ILIKE ${"%" + q + "%"}
          OR similarity(ticker, ${q}) > 0.2
        )
      ORDER BY score DESC, ticker ASC
      LIMIT ${limit}
    `;

    return NextResponse.json({ results: rows, query: q });
  } catch (err) {
    // Table may not exist yet on fresh DB
    console.error("Stock search error:", err);
    return NextResponse.json({ results: [], query: q });
  }
}
