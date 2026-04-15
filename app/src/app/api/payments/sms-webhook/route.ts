import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/postgres";
import { parseSms, normalizePhone } from "@/lib/sms-parser";

// SMS forwarder on merchant Android phone POSTs incoming SMS here.
// Auth: X-SMS-Webhook-Key header must match SMS_WEBHOOK_SECRET env var.
// ALWAYS returns 200 — SMS forwarder retries are fine but pointless.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-sms-webhook-key");
  const expected = process.env.SMS_WEBHOOK_SECRET;
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });

  const sender = (payload.sender as string) ?? "";
  const body = (payload.body as string) ?? "";
  if (!body) return NextResponse.json({ ok: true });

  const parsed = parseSms(sender, body);
  const sql = getDb();

  if (!parsed.provider || parsed.amount == null || !parsed.senderPhone || !parsed.trxid) {
    // Couldn't parse — log for manual review, return 200
    await sql`
      INSERT INTO unmatched_sms (sender, body, parsed_amount, parsed_phone, parsed_trxid)
      VALUES (${sender}, ${body}, ${parsed.amount}, ${parsed.senderPhone}, ${parsed.trxid})
    `;
    return NextResponse.json({ ok: true, status: "unparsed" });
  }

  const phone = normalizePhone(parsed.senderPhone);

  // Try to match to a pending payment (FIFO). FOR UPDATE SKIP LOCKED prevents races.
  const matched = await sql`
    UPDATE pending_payments
    SET status = 'paid',
        trxid = ${parsed.trxid},
        sms_body = ${body},
        matched_at = now()
    WHERE id = (
      SELECT id FROM pending_payments
      WHERE provider = ${parsed.provider}
        AND sender_phone = ${phone}
        AND amount_expected = ${parsed.amount as number}
        AND status = 'pending'
        AND expires_at > now()
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, user_id, tier
  `;

  const matchedAmount = parsed.amount as number;

  if (matched.length === 0) {
    // No pending match — log as unmatched for admin
    await sql`
      INSERT INTO unmatched_sms (sender, body, parsed_amount, parsed_phone, parsed_trxid)
      VALUES (${sender}, ${body}, ${matchedAmount}, ${phone}, ${parsed.trxid})
    `;
    return NextResponse.json({ ok: true, status: "no_match" });
  }

  const paid = matched[0];

  // Extend or create subscription — 1 month per payment
  await sql.begin(async (tx) => {
    // Is there an active subscription? If yes, extend its expires_at
    const [existing] = await tx`
      SELECT id, expires_at FROM subscriptions
      WHERE user_id = ${paid.user_id} AND status = 'active'
      ORDER BY expires_at DESC LIMIT 1
    `;

    if (existing && new Date(existing.expires_at) > new Date()) {
      // Extend from current expires_at
      await tx`
        UPDATE subscriptions
        SET expires_at = expires_at + interval '1 month',
            trxid = ${parsed.trxid},
            provider = ${parsed.provider},
            pending_payment_id = ${paid.id},
            amount_paid = ${parsed.amount}
        WHERE id = ${existing.id}
      `;
    } else {
      // New subscription — 1 month from now
      await tx`
        INSERT INTO subscriptions (
          user_id, plan, status, provider, trxid, pending_payment_id,
          amount_paid, started_at, expires_at
        ) VALUES (
          ${paid.user_id}, ${paid.tier === "entry" ? "pro" : paid.tier},
          'active', ${parsed.provider}, ${parsed.trxid}, ${paid.id},
          ${parsed.amount}, now(), now() + interval '1 month'
        )
      `;
    }

    // Bump session_version so JWT refresh picks up subscription change
    await tx`
      UPDATE users SET session_version = session_version + 1 WHERE id = ${paid.user_id}
    `;

    // Notify user in-app
    await tx`
      INSERT INTO notifications (user_id, type, title, body, severity, data)
      VALUES (
        ${paid.user_id},
        'daily_picks',
        'Subscription active ✓',
        ${"Your payment of ৳" + matchedAmount.toFixed(0) + " was received. Valid for 30 days. TrxID: " + parsed.trxid},
        'info',
        ${JSON.stringify({ tier: paid.tier, provider: parsed.provider, trxid: parsed.trxid })}
      )
    `;
  });

  return NextResponse.json({ ok: true, status: "matched", user_id: paid.user_id });
}
