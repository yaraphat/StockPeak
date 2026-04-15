import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

// Polled by paywall UI every 10s after confirm click.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sql = getDb();

  const [row] = await sql`
    SELECT id, status, matched_at, trxid, expires_at, amount_expected, provider, tier
    FROM pending_payments
    WHERE id = ${id} AND user_id = ${user.id as string}
  `;

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    status: row.status,
    matched_at: row.matched_at,
    trxid: row.trxid,
    expires_at: row.expires_at,
    amount: row.amount_expected,
    provider: row.provider,
    tier: row.tier,
  });
}
