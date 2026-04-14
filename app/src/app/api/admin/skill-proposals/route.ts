import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "pending";
  const sql = getDb();

  const rows = filter === "pending"
    ? await sql`
        SELECT
          sp.id, sp.skill_name, sp.proposal_type, sp.evidence_summary,
          sp.current_text, sp.proposed_text, sp.reasoning, sp.sample_size,
          sp.status, sp.review_note, sp.reviewed_at, sp.created_at
        FROM skill_proposals sp
        WHERE sp.status = 'pending'
        ORDER BY sp.created_at DESC
      `
    : await sql`
        SELECT
          sp.id, sp.skill_name, sp.proposal_type, sp.evidence_summary,
          sp.current_text, sp.proposed_text, sp.reasoning, sp.sample_size,
          sp.status, sp.review_note, sp.reviewed_at, sp.created_at
        FROM skill_proposals sp
        ORDER BY sp.created_at DESC
        LIMIT 50
      `;

  return NextResponse.json(rows);
}
