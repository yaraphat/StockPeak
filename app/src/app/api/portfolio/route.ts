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

  const holdings = await sql`
    SELECT * FROM portfolio_holdings
    WHERE user_id = ${userId}
    ORDER BY buy_date DESC
  `;

  return NextResponse.json({ holdings });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { ticker, company_name, buy_price, quantity, buy_date, notes } =
    await request.json();

  if (!ticker || !buy_price || !quantity) {
    return NextResponse.json(
      { error: "Ticker, buy price, and quantity are required" },
      { status: 400 }
    );
  }

  const sql = getDb();

  const result = await sql`
    INSERT INTO portfolio_holdings (user_id, ticker, company_name, buy_price, quantity, buy_date, notes)
    VALUES (${userId}, ${ticker.toUpperCase()}, ${company_name || ticker}, ${buy_price}, ${quantity}, ${buy_date || new Date().toISOString().split("T")[0]}, ${notes || null})
    RETURNING *
  `;

  return NextResponse.json({ holding: result[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Holding ID required" }, { status: 400 });
  }

  const sql = getDb();
  await sql`
    DELETE FROM portfolio_holdings WHERE id = ${id} AND user_id = ${userId}
  `;

  return NextResponse.json({ deleted: true });
}
