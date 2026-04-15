import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 100);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";

  const rows = unreadOnly
    ? await sql`
        SELECT id, type, title, body, ticker, data, severity, read_at, created_at
        FROM notifications
        WHERE user_id = ${user.id as string}
          AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT id, type, title, body, ticker, data, severity, read_at, created_at
        FROM notifications
        WHERE user_id = ${user.id as string}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
    FROM notifications
    WHERE user_id = ${user.id as string}
  `;

  return NextResponse.json({
    notifications: rows,
    total: countRow.total,
    unread: countRow.unread,
  });
}
