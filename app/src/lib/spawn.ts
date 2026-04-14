import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// In Docker: /opt/venv/bin/python3 and /app/scripts (set by entrypoint.sh)
// Locally: fall back to plain python3 and relative scripts dir
const PYTHON = process.env.PYTHON_BIN ?? "python3";
const SCRIPTS = process.env.SCRIPTS_DIR ?? path.join(process.cwd(), "..", "scripts");

export async function runScript(
  script: string,
  args: string[] = [],
  timeoutMs = 600_000
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(PYTHON, [path.join(SCRIPTS, script), ...args], {
    timeout: timeoutMs,
    env: { ...process.env },
    maxBuffer: 10 * 1024 * 1024,
  });
}
