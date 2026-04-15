import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScorecard } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scorecard = await getScorecard();
    return NextResponse.json(scorecard);
  } catch {
    return NextResponse.json({ error: "Failed to fetch scorecard" }, { status: 500 });
  }
}
