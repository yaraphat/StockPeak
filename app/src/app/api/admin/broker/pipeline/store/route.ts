import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runScript } from "@/lib/spawn";
import os from "os";
import path from "path";

const TMP = process.env.STOCKPEAK_TMP_DIR ?? os.tmpdir();

/**
 * POST /api/admin/broker/pipeline/store
 *
 * Stage 3 — store_picks.py
 * Validates picks envelope from stage 2, writes to PostgreSQL (idempotent),
 * dispatches Telegram and email notifications.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];
  const inPath = path.join(TMP, `stockpeak-picks-${today}.json`);

  try {
    const { stdout, stderr } = await runScript(
      "store_picks.py",
      ["--in", inPath],
      120_000
    );
    return NextResponse.json({ ok: true, output: stderr || stdout });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
