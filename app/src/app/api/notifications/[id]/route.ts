import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sql = getDb();
  const { read } = await req.json() as { read: boolean };

  if (read) {
    await sql`
      UPDATE notifications SET read_at = now()
      WHERE id = ${id} AND user_id = ${user.id as string}
    `;
  } else {
    await sql`
      UPDATE notifications SET read_at = NULL
      WHERE id = ${id} AND user_id = ${user.id as string}
    `;
  }

  return NextResponse.json({ ok: true });
}
