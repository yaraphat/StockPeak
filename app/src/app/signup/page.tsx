"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1: Create account via API
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে");
      setLoading(false);
      return;
    }

    // Step 2: Auto-login after signup
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("অ্যাকাউন্ট তৈরি হয়েছে কিন্তু লগইন করতে সমস্যা। লগইন পেজে যান।");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-2xl font-bold">Stock Peak</Link>
          <p className="font-bengali text-sm text-[var(--color-muted)] mt-2">৭ দিনের ফ্রি ট্রায়াল শুরু করুন</p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-bengali">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 font-bengali">নাম</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" autoComplete="name" className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition" required disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition" required disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 font-bengali">পাসওয়ার্ড</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" minLength={8} className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition" required disabled={loading} />
            </div>

            <div className="p-3 bg-[var(--background)] rounded-lg text-xs text-[var(--color-muted)] font-bengali">
              ৭ দিনের ফ্রি ট্রায়াল। এরপর ৳২৯৯/মাস। কোনো ক্রেডিট কার্ড লাগবে না।
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-2.5 rounded-lg transition-opacity text-sm disabled:opacity-50">
              {loading ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "ফ্রি ট্রায়াল শুরু করুন"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-border)]" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-[var(--color-surface)] px-2 text-[var(--color-muted)]">অথবা</span></div>
          </div>

          <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="w-full border border-[var(--color-border)] font-medium py-2.5 rounded-lg hover:bg-[var(--background)] transition-colors text-sm flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google দিয়ে সাইন আপ
          </button>

          <p className="text-xs text-[var(--color-muted)] text-center mt-4 font-bengali">
            সাইন আপ করে আপনি আমাদের{" "}
            <Link href="/disclaimer" className="underline">শর্তাবলী</Link> ও{" "}
            <Link href="/privacy" className="underline">গোপনীয়তা নীতি</Link> মেনে নিচ্ছেন
          </p>
        </div>

        <p className="text-center text-sm text-[var(--color-muted)] mt-4">
          ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
          <Link href="/login" className="text-[var(--color-primary)] font-medium">লগইন করুন</Link>
        </p>
      </div>
    </div>
  );
}
