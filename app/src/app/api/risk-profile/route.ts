import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";

const VALID_TIERS = ["conservative", "moderate", "aggressive"] as const;
type RiskTier = (typeof VALID_TIERS)[number];

// 5-question scoring: each answer is 0 (conservative) → 2 (aggressive)
// Total score 0-10 → tier: 0-3 conservative, 4-7 moderate, 8-10 aggressive
function scoreToTier(answers: number[]): RiskTier {
  const total = answers.reduce((sum, v) => sum + v, 0);
  if (total <= 3) return "conservative";
  if (total <= 7) return "moderate";
  return "aggressive";
}

function validateAnswers(answers: unknown): number[] | null {
  if (!Array.isArray(answers) || answers.length !== 5) return null;
  for (const a of answers) {
    if (typeof a !== "number" || a < 0 || a > 2 || !Number.isInteger(a)) return null;
  }
  return answers as number[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const sql = getDb();

  const rows = await sql`
    SELECT risk_tier, risk_answers, risk_profile_set_at
    FROM users WHERE id = ${userId}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { risk_tier, risk_answers, risk_profile_set_at } = rows[0];
  return NextResponse.json({
    risk_tier,
    risk_answers,
    risk_profile_set_at,
    has_completed_questionnaire: risk_profile_set_at !== null,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const sql = getDb();

  const body = await request.json();
  const answers = validateAnswers(body.answers);

  if (!answers) {
    return NextResponse.json(
      { error: "answers must be an array of 5 integers (0, 1, or 2)" },
      { status: 400 }
    );
  }

  // 30-day lock: check when profile was last set
  const existing = await sql`
    SELECT risk_profile_set_at FROM users WHERE id = ${userId}
  `;

  if (existing.length > 0 && existing[0].risk_profile_set_at !== null) {
    const setAt = new Date(existing[0].risk_profile_set_at);
    const daysSince = (Date.now() - setAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince < 30) {
      const daysRemaining = Math.ceil(30 - daysSince);
      return NextResponse.json(
        {
          error: "Risk profile locked for 30 days after submission",
          days_remaining: daysRemaining,
          locked_until: new Date(setAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { status: 409 }
      );
    }
  }

  const tier = scoreToTier(answers);

  await sql`
    UPDATE users
    SET
      risk_tier = ${tier},
      risk_answers = ${JSON.stringify(answers)},
      risk_profile_set_at = now()
    WHERE id = ${userId}
  `;

  return NextResponse.json({
    risk_tier: tier,
    message: "Risk profile saved",
  });
}
