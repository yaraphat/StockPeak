import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/postgres";
import { isValidBdMobile, normalizePhone } from "@/lib/sms-parser";
import { rateLimit } from "@/lib/rate-limit";

const TIER_AMOUNTS: Record<string, number> = {
  entry: 260,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit — 5 payment confirmations per user per day
  const rl = rateLimit(req, { limit: 5, windowMs: 24 * 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const provider = body.provider as string;
  const tier = (body.tier as string) ?? "entry";
  const rawPhone = (body.sender_phone as string) ?? "";
  const phone = normalizePhone(rawPhone);

  if (!["bkash", "nagad"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (!isValidBdMobile(phone)) {
    return NextResponse.json({ error: "Invalid Bangladeshi mobile number" }, { status: 400 });
  }
  const amount = TIER_AMOUNTS[tier];
  if (!amount) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

  const sql = getDb();

  // Check for an active pending payment from same user+phone within last 10 min
  // (prevents duplicate clicks creating multiple pending rows)
  const existing = await sql`
    SELECT id FROM pending_payments
    WHERE user_id = ${user.id as string}
      AND sender_phone = ${phone}
      AND status = 'pending'
      AND created_at > now() - interval '10 minutes'
    ORDER BY created_at DESC LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json({
      pending_payment_id: existing[0].id,
      message: "Payment already pending verification",
    });
  }

  const [row] = await sql`
    INSERT INTO pending_payments (user_id, provider, sender_phone, amount_expected, tier, status)
    VALUES (${user.id as string}, ${provider}, ${phone}, ${amount}, ${tier}, 'pending')
    RETURNING id
  `;

  return NextResponse.json({
    pending_payment_id: row.id,
    message: "Payment confirmed. We'll verify within a few minutes.",
    amount,
    provider,
    phone,
  });
}
