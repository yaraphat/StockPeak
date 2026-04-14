import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runScript } from "@/lib/spawn";
import os from "os";
import path from "path";

const TMP = process.env.STOCKPEAK_TMP_DIR ?? os.tmpdir();

const BACKEND_SCRIPTS: Record<string, string> = {
  openrouter:    "generate_picks_openrouter.py",
  "claude-code": "generate_picks_claude_code.py",
  sdk:           "generate_picks_llm.py",
};

/**
 * POST /api/admin/broker/pipeline/generate
 *
 * Stage 2 — LLM pick generation.
 * Reads candidates envelope written by stage 1, calls the LLM backend
 * selected by PICKS_BACKEND env var, writes picks envelope.
 *
 * Body (optional JSON):
 *   { "backend": "openrouter" | "claude-code" | "sdk" }  — override PICKS_BACKEND
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let backendOverride: string | undefined;
  try {
    const body = await req.json();
    backendOverride = body?.backend;
  } catch { /* body optional */ }

  const backend = backendOverride ?? process.env.PICKS_BACKEND ?? "openrouter";
  const script = BACKEND_SCRIPTS[backend] ?? BACKEND_SCRIPTS["openrouter"];

  const today = new Date().toISOString().split("T")[0];
  const inPath = path.join(TMP, `stockpeak-candidates-${today}.json`);
  const outPath = path.join(TMP, `stockpeak-picks-${today}.json`);

  try {
    const { stdout, stderr } = await runScript(
      script,
      ["--in", inPath, "--out", outPath],
      300_000
    );
    return NextResponse.json({
      ok: true,
      backend,
      script,
      out: outPath,
      output: stderr || stdout,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
