import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const result = await sql`
    UPDATE notifications
    SET read_at = now()
    WHERE user_id = ${user.id as string}
      AND read_at IS NULL
  `;

  return NextResponse.json({ ok: true, marked: result.count });
}
