import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runScript } from "@/lib/spawn";

/**
 * POST /api/admin/broker/pipeline
 *
 * Runs the full three-stage picks pipeline:
 *   prepare_candidates.py → generate_picks_*.py → store_picks.py
 *
 * Backend selection follows the PICKS_BACKEND env var (default: openrouter).
 * Stores picks to DB and sends Telegram/email notifications.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { stdout, stderr } = await runScript("daily_picks.py", [], 900_000);
    return NextResponse.json({ ok: true, output: stderr || stdout });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
