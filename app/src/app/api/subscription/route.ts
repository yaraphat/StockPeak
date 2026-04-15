import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAccess } from "@/lib/access";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getUserAccess(user.id as string);
  if (!access) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    access_status: access.accessStatus,
    trial_ends_at: access.trialEndsAt,
    trial_days_remaining: access.trialDaysRemaining,
    subscription_expires_at: access.subscriptionExpiresAt,
    subscription_days_remaining: access.subscriptionDaysRemaining,
  });
}
