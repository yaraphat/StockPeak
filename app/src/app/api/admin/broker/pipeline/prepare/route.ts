import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runScript } from "@/lib/spawn";
import os from "os";
import path from "path";

const TMP = process.env.STOCKPEAK_TMP_DIR ?? os.tmpdir();

/**
 * POST /api/admin/broker/pipeline/prepare
 *
 * Stage 1 — prepare_candidates.py
 * Reads the broker report from DB / file, filters candidates, writes
 * a candidates envelope to /tmp/stockpeak-candidates-<date>.json.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date().toISOString().split("T")[0];
  const outPath = path.join(TMP, `stockpeak-candidates-${today}.json`);

  try {
    const { stdout, stderr } = await runScript(
      "prepare_candidates.py",
      ["--out", outPath],
      300_000
    );
    return NextResponse.json({ ok: true, out: outPath, output: stderr || stdout });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
