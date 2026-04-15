/**
 * Simple in-memory rate limiter for Next.js route handlers.
 * Keyed by IP address. Resets on server restart — good enough for a single-process
 * Docker deployment. For multi-instance, swap the Map for Redis.
 *
 * Usage:
 *   const result = rateLimit(req, { limit: 10, windowMs: 60_000 });
 *   if (!result.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Prune entries older than 5 minutes every 5 minutes to avoid unbounded growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store.entries()) {
      if (win.resetAt < now) store.delete(key);
    }
  }, 5 * 60_000);
}

export function rateLimit(
  req: { headers: { get(name: string): string | null } },
  opts: { limit: number; windowMs: number }
): { ok: boolean; remaining: number; resetAt: number } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}`;
  const now = Date.now();
  let win = store.get(key);

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, win);
  }

  win.count += 1;
  const remaining = Math.max(0, opts.limit - win.count);
  return { ok: win.count <= opts.limit, remaining, resetAt: win.resetAt };
}
