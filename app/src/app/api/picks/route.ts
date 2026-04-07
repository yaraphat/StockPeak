import { NextResponse } from "next/server";
import { getTodaysPicks, getPicksByDate } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  try {
    const picks = date ? await getPicksByDate(date) : await getTodaysPicks();
    return NextResponse.json({ picks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch picks" },
      { status: 500 }
    );
  }
}
