import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getDb } from "./postgres";

// Simple in-process login rate limiter: 10 attempts per IP per 15 min
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 15 * 60_000;
  let entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + window };
    loginAttempts.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= 10;
}

// Fetch a user's subscription + trial state for JWT claims
async function fetchUserAccess(userId: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM v_user_access WHERE user_id = ${userId}`;
  if (rows.length === 0) return null;
  return {
    session_version: rows[0].session_version,
    access_status: rows[0].access_status,
    trial_ends_at: rows[0].trial_ends_at,
    subscription_expires_at: rows[0].subscription_expires_at,
    current_tier: rows[0].current_tier,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip =
          (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
          (req?.headers?.["x-real-ip"] as string | undefined) ??
          "unknown";
        if (!checkLoginRateLimit(ip)) {
          throw new Error("Too many login attempts. Try again in 15 minutes.");
        }

        const sql = getDb();
        const users = await sql`
          SELECT id, email, name, password_hash, role, trial_ends_at
          FROM users WHERE email = ${credentials.email}
        `;

        if (users.length === 0) return null;

        const user = users[0];
        if (!user.password_hash) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          trialEndsAt: user.trial_ends_at,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as Record<string, unknown>).role as string;
        token.trialEndsAt = (user as unknown as Record<string, unknown>).trialEndsAt as string;
      }

      if (account?.provider === "google" && user?.email) {
        const sql = getDb();
        const existing = await sql`
          SELECT id, role, trial_ends_at FROM users WHERE email = ${user.email}
        `;

        if (existing.length > 0) {
          token.id = existing[0].id;
          token.role = existing[0].role;
          token.trialEndsAt = existing[0].trial_ends_at;
        } else {
          const created = await sql`
            INSERT INTO users (email, name, google_id, role)
            VALUES (${user.email}, ${user.name ?? null}, ${account.providerAccountId}, 'free')
            RETURNING id, role, trial_ends_at
          `;
          token.id = created[0].id;
          token.role = created[0].role;
          token.trialEndsAt = created[0].trial_ends_at;
        }
      }

      // Refresh subscription claims on signin or explicit update() trigger
      if (token.id && (user || trigger === "update")) {
        const access = await fetchUserAccess(token.id as string);
        if (access) {
          token.sessionVersion = access.session_version;
          token.accessStatus = access.access_status;
          token.subscriptionExpiresAt = access.subscription_expires_at;
          token.currentTier = access.current_tier;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = token.id;
        u.role = token.role;
        u.trialEndsAt = token.trialEndsAt;
        u.sessionVersion = token.sessionVersion;
        u.accessStatus = token.accessStatus ?? "expired";
        u.subscriptionExpiresAt = token.subscriptionExpiresAt;
        u.currentTier = token.currentTier ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/welcome",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24h — forces daily re-fetch of subscription state
  },
  secret: process.env.NEXTAUTH_SECRET,
};
