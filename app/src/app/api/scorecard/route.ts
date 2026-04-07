import { NextResponse } from "next/server";
import { getScorecard } from "@/lib/db";

export async function GET() {
  try {
    const scorecard = await getScorecard();
    return NextResponse.json(scorecard);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch scorecard" },
      { status: 500 }
    );
  }
}
