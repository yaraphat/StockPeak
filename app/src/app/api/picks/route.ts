import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTodaysPicks, getPicksByDate } from "@/lib/db";

// Simple date format guard — prevents unexpected DB queries
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (date && !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const picks = date ? await getPicksByDate(date) : await getTodaysPicks();
    return NextResponse.json({ picks });
  } catch {
    return NextResponse.json({ error: "Failed to fetch picks" }, { status: 500 });
  }
}
