import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

type Action = "approved" | "rejected" | "deferred";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const action: Action = body.action;
  const reviewNote: string = body.review_note ?? "";

  if (!["approved", "rejected", "deferred"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const sql = getDb();

  const rows = await sql`
    UPDATE skill_proposals
    SET
      status = ${action},
      reviewed_by = ${user.id as string},
      reviewed_at = now(),
      review_note = ${reviewNote}
    WHERE id = ${id} AND status = 'pending'
    RETURNING id, status
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Proposal not found or already reviewed" },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: rows[0].id, status: rows[0].status });
}
