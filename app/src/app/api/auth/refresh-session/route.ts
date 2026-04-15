import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Forces the client to re-fetch its JWT so updated claims (subscription status) land.
 * The frontend calls this after a payment confirms, then NextAuth useSession refetches.
 * The actual claim refresh happens in authOptions.callbacks.jwt when the token is re-signed.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, refreshAt: new Date().toISOString() });
}
