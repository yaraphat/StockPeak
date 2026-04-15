import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/postgres";
import { rateLimit } from "@/lib/rate-limit";

// Very permissive email regex — just catches obvious garbage
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // 10 signup attempts per IP per 15 minutes
  const rl = rateLimit(request, { limit: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { name, email, password } = body as Record<string, unknown>;

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const emailClean = email.trim().toLowerCase();

    if (!EMAIL_RE.test(emailClean)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (emailClean.length > 254) {
      return NextResponse.json({ error: "Email address too long" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

    // Require at least one letter and one non-letter character to block "12345678"
    if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one letter and one number or symbol" },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Check duplicate — hash anyway to maintain constant timing and prevent
    // enumeration via response time differences
    const [existing, passwordHash] = await Promise.all([
      sql`SELECT id FROM users WHERE email = ${emailClean}`,
      bcrypt.hash(password, 12),
    ]);

    if (existing.length > 0) {
      // Return 409 (standard REST) — user already knows their own email
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const nameClean = typeof name === "string" ? name.trim().slice(0, 100) || null : null;

    const result = await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${emailClean}, ${nameClean}, ${passwordHash}, 'free')
      RETURNING id, email, name, role, trial_ends_at
    `;

    return NextResponse.json({
      user: {
        id: result[0].id,
        email: result[0].email,
        name: result[0].name,
        role: result[0].role,
        trialEndsAt: result[0].trial_ends_at,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
