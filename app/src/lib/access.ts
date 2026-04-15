/**
 * Access control helpers — shared between middleware, API routes, and server components.
 * Uses the v_user_access view (declared in schema-m1.sql) as the single source of truth
 * for whether a user has access to gated content.
 */

import { getDb } from "./postgres";

export type AccessStatus = "subscribed" | "trial" | "grace" | "expired";

export interface UserAccess {
  userId: string;
  accessStatus: AccessStatus;
  trialEndsAt: Date | null;
  subscriptionExpiresAt: Date | null;
  sessionVersion: number;
  /** Days until trial ends (negative = already expired) */
  trialDaysRemaining: number | null;
  /** Days until subscription expires (negative = already expired) */
  subscriptionDaysRemaining: number | null;
}

export async function getUserAccess(userId: string): Promise<UserAccess | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM v_user_access WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];

  const now = new Date();
  const trialEndsAt = r.trial_ends_at ? new Date(r.trial_ends_at) : null;
  const subExpiresAt = r.subscription_expires_at ? new Date(r.subscription_expires_at) : null;

  return {
    userId: r.user_id,
    accessStatus: r.access_status as AccessStatus,
    trialEndsAt,
    subscriptionExpiresAt: subExpiresAt,
    sessionVersion: r.session_version,
    trialDaysRemaining: trialEndsAt
      ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000)
      : null,
    subscriptionDaysRemaining: subExpiresAt
      ? Math.ceil((subExpiresAt.getTime() - now.getTime()) / 86400000)
      : null,
  };
}

/** True if user can access premium features (picks, full charts, P&L) */
export function hasActiveAccess(access: UserAccess | null): boolean {
  if (!access) return false;
  return access.accessStatus === "subscribed" || access.accessStatus === "trial";
}

/** Bumps session_version — invalidates existing JWTs at next refresh */
export async function bumpSessionVersion(userId: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
}

/**
 * API route guard. Returns the userId if the user has active access (trial or subscribed),
 * or a NextResponse with the appropriate status code.
 *
 * Usage in route.ts:
 *   const gate = await requireActiveAccess();
 *   if ("error" in gate) return gate.error;
 *   const { userId, access } = gate;
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export type AccessGate =
  | { error: NextResponse; userId?: undefined; access?: undefined }
  | { userId: string; access: UserAccess; error?: undefined };

export async function requireActiveAccess(): Promise<AccessGate> {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userId = user.id as string;
  const access = await getUserAccess(userId);
  if (!access || !hasActiveAccess(access)) {
    return {
      error: NextResponse.json(
        {
          error: "Subscription required",
          access_status: access?.accessStatus ?? "none",
          upgrade_url: "/subscribe",
        },
        { status: 402 }  // 402 Payment Required
      ),
    };
  }
  return { userId, access };
}

/** Loosely-gated — requires auth but not active subscription. Returns userId or error. */
export async function requireAuth(): Promise<{ userId: string; access: UserAccess | null } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const userId = user.id as string;
  const access = await getUserAccess(userId);
  return { userId, access };
}
