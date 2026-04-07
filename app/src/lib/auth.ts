import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getDb } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as Record<string, unknown>).role as string;
        token.trialEndsAt = (user as unknown as Record<string, unknown>).trialEndsAt as string;
      }

      // Handle Google sign-in: create or find user in DB
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

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).trialEndsAt = token.trialEndsAt;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
