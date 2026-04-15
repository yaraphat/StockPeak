import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

// Per-user portfolio P&L. Pure arithmetic — no AI.
// Uses latest close from stock_data (joined via LATERAL for cleanest plan).
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();

  try {
    const holdings = await sql`
      SELECT
        ph.id,
        ph.ticker,
        ph.quantity::numeric AS quantity,
        ph.buy_price::numeric AS buy_price,
        ph.created_at,
        ds.company_name,
        ds.company_name_bn,
        ds.category,
        latest.close::numeric AS current_price,
        latest.date::text AS price_date,
        latest.change_pct::numeric AS day_change_pct
      FROM portfolio_holdings ph
      LEFT JOIN dse_stocks ds ON ds.ticker = ph.ticker
      LEFT JOIN LATERAL (
        SELECT sd.close, sd.date, sd.change_pct
        FROM stock_data sd
        WHERE sd.ticker = ph.ticker
        ORDER BY sd.date DESC
        LIMIT 1
      ) latest ON true
      WHERE ph.user_id = ${userId}
      ORDER BY ph.created_at DESC
    `;

    const enriched = holdings.map((h: Record<string, unknown>) => {
      const qty = Number(h.quantity);
      const buy = Number(h.buy_price);
      const current = h.current_price != null ? Number(h.current_price) : null;
      const invested = qty * buy;
      const currentValue = current != null ? qty * current : null;
      const pnl = currentValue != null ? currentValue - invested : null;
      const pnlPct = current != null && buy > 0 ? ((current - buy) / buy) * 100 : null;

      // Stale-data flag: price_date older than 2 business days = likely stale
      const priceDate = h.price_date ? new Date(h.price_date as string) : null;
      const isStale = priceDate
        ? (Date.now() - priceDate.getTime()) / 86400000 > 3
        : current == null;

      return {
        id: h.id,
        ticker: h.ticker,
        company_name: h.company_name,
        company_name_bn: h.company_name_bn,
        category: h.category,
        quantity: qty,
        buy_price: buy,
        invested,
        current_price: current,
        current_value: currentValue,
        price_date: h.price_date,
        day_change_pct: h.day_change_pct != null ? Number(h.day_change_pct) : null,
        pnl,
        pnl_pct: pnlPct,
        is_stale: isStale,
      };
    });

    const totalInvested = enriched.reduce(
      (a, h) => a + (h.invested ?? 0),
      0
    );
    const totalValue = enriched.reduce(
      (a, h) => a + (h.current_value ?? h.invested),
      0
    );
    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    // Suggestive insights
    const insights: string[] = [];
    if (enriched.length === 0) {
      insights.push("আপনার পোর্টফোলিও খালি। প্রথম স্টক যোগ করুন।");
    } else {
      const biggestWinner = enriched
        .filter((h) => h.pnl_pct != null && h.pnl_pct > 0)
        .sort((a, b) => (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0))[0];
      if (biggestWinner) {
        insights.push(
          `আজকের সেরা: ${biggestWinner.ticker} ${biggestWinner.pnl_pct!.toFixed(1)}%`
        );
      }
      const stales = enriched.filter((h) => h.is_stale).length;
      if (stales > 0) insights.push(`${stales}টি স্টকের দাম পুরনো — বাজার বন্ধ থাকতে পারে`);
      // Sector concentration
      const bySector = enriched.reduce<Record<string, number>>((acc, h) => {
        const s = (h.category as string) ?? "other";
        acc[s] = (acc[s] ?? 0) + (h.current_value ?? h.invested);
        return acc;
      }, {});
      const maxSector = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0];
      if (maxSector && totalValue > 0 && maxSector[1] / totalValue > 0.5) {
        insights.push(
          `সতর্কতা: ${((maxSector[1] / totalValue) * 100).toFixed(0)}% ${maxSector[0]} ক্যাটেগরিতে — বৈচিত্র্য বাড়ান`
        );
      }
    }

    return NextResponse.json({
      holdings: enriched,
      summary: {
        total_holdings: enriched.length,
        total_invested: totalInvested,
        total_value: totalValue,
        total_pnl: totalPnl,
        total_pnl_pct: totalPnlPct,
        as_of: enriched.find((h) => h.price_date)?.price_date ?? null,
      },
      insights,
    });
  } catch (err) {
    console.error("P&L error:", err);
    return NextResponse.json({ error: "Failed to compute P&L" }, { status: 500 });
  }
}
