import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";
import { requireActiveAccess } from "@/lib/access";

export async function GET(req: NextRequest) {
  // Pro feature — notifications about picks/holdings are gated
  const gate = await requireActiveAccess();
  if ("error" in gate) return gate.error;
  const { userId } = gate;

  const sql = getDb();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 100);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";

  const rows = unreadOnly
    ? await sql`
        SELECT id, type, title, body, ticker, data, severity, read_at, created_at
        FROM notifications
        WHERE user_id = ${userId}
          AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT id, type, title, body, ticker, data, severity, read_at, created_at
        FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
    FROM notifications
    WHERE user_id = ${userId}
  `;

  return NextResponse.json({
    notifications: rows,
    total: countRow.total,
    unread: countRow.unread,
  });
}
