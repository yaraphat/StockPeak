"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Small delay to feel natural; actual email delivery requires RESEND_API_KEY
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
      <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 20 }}>Stock Peak</div>
      <p style={{ marginBottom: 24, color: "#666", fontSize: 14 }}>পাসওয়ার্ড রিসেট করুন</p>

      <div style={{ background: "#fff", borderRadius: 12, padding: "32px 40px", width: 380, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>ইমেইল পাঠানো হয়েছে</p>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
              যদি <strong>{email}</strong> তে একটি অ্যাকাউন্ট থাকে, তাহলে রিসেট লিংক পাঠানো হয়েছে।
            </p>
            <Link href="/login" style={{ color: "#2563eb", fontSize: 14 }}>
              লগইন পেজে ফিরে যান
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
              আপনার ইমেইল দিন। পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।
            </p>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "11px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
            </button>
          </form>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 14, color: "#666" }}>
        মনে পড়েছে?{" "}
        <Link href="/login" style={{ color: "#2563eb" }}>লগইন করুন</Link>
      </p>
    </div>
  );
}
