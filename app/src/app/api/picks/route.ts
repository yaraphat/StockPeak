import { NextRequest, NextResponse } from "next/server";
import { getTodaysPicks, getPicksByDate } from "@/lib/db";
import { requireActiveAccess } from "@/lib/access";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  // Pro feature — requires active trial or subscription (402 if expired)
  const gate = await requireActiveAccess();
  if ("error" in gate) return gate.error;

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
