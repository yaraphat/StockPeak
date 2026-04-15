import { NextResponse } from "next/server";
import { getScorecard } from "@/lib/db";
import { requireActiveAccess } from "@/lib/access";

// Detailed scorecard is a Pro feature. The aggregate numbers shown on the landing page
// come from a separate static/marketing source, not this endpoint.
export async function GET() {
  const gate = await requireActiveAccess();
  if ("error" in gate) return gate.error;

  try {
    const scorecard = await getScorecard();
    return NextResponse.json(scorecard);
  } catch {
    return NextResponse.json({ error: "Failed to fetch scorecard" }, { status: 500 });
  }
}
