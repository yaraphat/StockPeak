import Link from "next/link";
import { StockSearch } from "@/components/stock-search";

export default function Home() {
  return (
    <main className="relative">
      {/* Glossy hero with radial glow + subtle grid */}
      <section className="relative px-6 pt-20 pb-16 max-w-3xl mx-auto text-center overflow-hidden">
        {/* Background effect layer */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(0,102,204,0.15) 0%, transparent 70%)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            }}
          />
        </div>

        <span
          className="inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6 border"
          style={{
            background: "linear-gradient(135deg, rgba(0,102,204,0.08) 0%, rgba(0,102,204,0.03) 100%)",
            borderColor: "rgba(0,102,204,0.2)",
            color: "#0066CC",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
          AI-Powered DSE Analysis
        </span>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
          <span style={{ background: "linear-gradient(180deg, #1C1917 0%, #44403C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            প্রতিদিন সকালে স্মার্ট
            <br />
            স্টক পিক পান
          </span>
        </h1>
        <p className="font-bengali text-lg text-[var(--color-muted)] max-w-xl mx-auto mb-6 leading-relaxed">
          AI বিশ্লেষণের মাধ্যমে প্রতিদিন সকাল ১০:৩০টায় ৩টি সেরা DSE স্টক পিক পান।
          বাই জোন, টার্গেট, স্টপ-লস, পোর্টফোলিও P&L ট্র্যাকিং এবং বিস্তারিত বিশ্লেষণসহ।
        </p>

        {/* Stock search widget — conversion funnel */}
        <div className="max-w-md mx-auto mb-6">
          <StockSearch placeholder="Try any DSE stock: BEXIMCO, SQURPHARMA..." />
          <p className="text-[11px] text-[var(--color-muted)] mt-2">
            Free DSE price charts · No signup required · Press <kbd className="bg-white border border-[var(--color-border)] rounded px-1 py-0.5 font-mono text-[9px]">/</kbd> anywhere to search
          </p>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className="group relative bg-gradient-to-br from-[#0066CC] to-[#0052A3] text-white font-semibold px-6 py-3 rounded-lg transition-all hover:shadow-[0_8px_24px_rgba(0,102,204,0.3)] hover:-translate-y-0.5"
            style={{ boxShadow: "0 2px 4px rgba(0,102,204,0.2), inset 0 1px 0 rgba(255,255,255,0.15)" }}
          >
            ৭ দিন ফ্রি ট্রায়াল শুরু করুন
          </Link>
          <Link
            href="#proof"
            className="border border-[var(--color-border)] font-semibold px-6 py-3 rounded-lg hover:bg-[var(--color-surface)] hover:border-[var(--color-muted)] transition-all bg-white/50 backdrop-blur-sm"
          >
            Track Record দেখুন
          </Link>
        </div>
      </section>

      {/* Proof section — scorecard (aggregate) + locked teaser (no picks given away) */}
      <section id="proof" className="px-6 pb-16 max-w-3xl mx-auto space-y-4">

        {/* Scorecard — aggregate stats, no individual picks */}
        <div
          className="bg-white rounded-2xl overflow-hidden relative"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 24px 48px rgba(0,102,204,0.04)",
            border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          <div className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-60" />
          <div className="px-6 py-5 border-b border-[var(--color-border-subtle)]">
            <h2 className="font-display text-xl font-semibold">Our Track Record</h2>
            <p className="text-[11px] text-[var(--color-muted)] mt-1">
              Aggregate outcomes across all our AI-generated DSE picks
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[var(--color-border-subtle)]">
            <div className="p-6 text-center">
              <div
                className="font-mono text-4xl font-bold tabular-nums"
                style={{
                  background: "linear-gradient(180deg, #16A34A 0%, #15803D 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                62%
              </div>
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest mt-1">Hit Rate</div>
            </div>
            <div className="p-6 text-center">
              <div className="font-mono text-4xl font-bold tabular-nums">43</div>
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest mt-1">Total Picks</div>
            </div>
            <div className="p-6 text-center">
              <div
                className="font-mono text-4xl font-bold tabular-nums"
                style={{
                  background: "linear-gradient(180deg, #16A34A 0%, #15803D 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                +7.2%
              </div>
              <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest mt-1">Avg Gain</div>
            </div>
          </div>
        </div>

        {/* Locked teaser — "today's picks are behind the paywall" */}
        <div
          className="relative bg-white rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(0,102,204,0.2)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,102,204,0.08)",
          }}
        >
          <div className="px-6 py-5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">Today&apos;s Picks</h3>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5">Updated every trading day at 10:30 AM BDT</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(0,102,204,0.1) 0%, rgba(0,102,204,0.04) 100%)",
                color: "#0066CC",
                border: "1px solid rgba(0,102,204,0.2)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Pro only
            </span>
          </div>

          {/* Blurred preview — shows the shape of the product without giving away picks */}
          <div className="relative p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{
                  background: "linear-gradient(135deg, rgba(248,246,244,0.9) 0%, rgba(255,255,255,0.5) 100%)",
                  border: "1px solid rgba(0,0,0,0.04)",
                  filter: "blur(4px) saturate(0.6)",
                  opacity: 0.7,
                  userSelect: "none",
                }}
                aria-hidden="true"
              >
                <div className="flex-1">
                  <div className="h-3 w-24 bg-[var(--color-muted)]/30 rounded mb-2" />
                  <div className="h-2 w-40 bg-[var(--color-muted)]/20 rounded" />
                </div>
                <div className="text-right">
                  <div className="h-4 w-16 bg-[var(--color-muted)]/30 rounded mb-1" />
                  <div className="h-2 w-20 bg-[var(--color-muted)]/20 rounded" />
                </div>
                <div className="h-6 w-20 bg-[#16A34A]/20 rounded-full" />
              </div>
            ))}

            {/* CTA overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="pointer-events-auto bg-white rounded-xl p-6 text-center max-w-xs"
                style={{
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 24px 48px rgba(0,102,204,0.1)",
                  border: "1px solid rgba(0,102,204,0.2)",
                }}
              >
                <div
                  className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)",
                    boxShadow: "0 4px 12px rgba(0,102,204,0.3)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <h4 className="font-semibold text-sm mb-1">Today&apos;s picks are for Pro subscribers</h4>
                <p className="text-xs text-[var(--color-muted)] font-bengali mb-4">
                  ৭ দিন ফ্রি ট্রায়াল শুরু করুন — কার্ড লাগবে না
                </p>
                <Link
                  href="/signup"
                  className="block text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-all hover:shadow-[0_4px_12px_rgba(0,102,204,0.3)]"
                  style={{
                    background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)",
                    boxShadow: "0 2px 4px rgba(0,102,204,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}
                >
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-semibold mb-8 text-center">কিভাবে কাজ করে</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: "১", title: "সকাল ১০:৩০টা", desc: "AI ৪০০+ DSE স্টক বিশ্লেষণ করে সেরা ৩টি বাছাই করে" },
            { step: "২", title: "ইন-অ্যাপ নোটিফিকেশন", desc: "ব্রাউজার নোটিফিকেশনে সাথে সাথে জানতে পারবেন — বাই জোন, টার্গেট, স্টপ-লস" },
            { step: "৩", title: "পোর্টফোলিও ট্র্যাক", desc: "আপনার হোল্ডিংসের P&L স্বয়ংক্রিয়ভাবে হিসাব হয়" },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-display font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="font-bengali text-sm text-[var(--color-muted)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — glossy with gradient + accent */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-semibold mb-2 text-center">Pricing</h2>
        <p className="text-center text-sm text-[var(--color-muted)] mb-8 font-bengali">
          ৭ দিন ফ্রি ট্রায়াল · কোনো কার্ড লাগবে না
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div
            className="bg-white rounded-2xl p-6 transition-all hover:-translate-y-1"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
            }}
          >
            <h3 className="font-semibold text-lg mb-1">Free</h3>
            <div className="font-display text-4xl font-bold mb-4 tabular-nums">৳০</div>
            <ul className="space-y-2 text-sm text-[var(--color-muted)] mb-6 font-bengali">
              <li className="flex items-start gap-2"><span className="text-[var(--color-muted)] mt-0.5">·</span>১টি পিক / দিন (বিলম্বিত)</li>
              <li className="flex items-start gap-2"><span className="text-[var(--color-muted)] mt-0.5">·</span>বিশ্লেষণ ছাড়া</li>
              <li className="flex items-start gap-2"><span className="text-[var(--color-muted)] mt-0.5">·</span>ওয়েব ড্যাশবোর্ড</li>
            </ul>
            <Link href="/signup" className="block text-center border border-[var(--color-border)] font-semibold py-2.5 rounded-lg hover:bg-[var(--background)] hover:border-[var(--color-muted)] transition-all text-sm">
              Sign Up Free
            </Link>
          </div>
          <div
            className="relative rounded-2xl p-6 transition-all hover:-translate-y-1"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, rgba(0,102,204,0.03) 100%)",
              border: "1px solid rgba(0,102,204,0.25)",
              boxShadow: "0 1px 2px rgba(0,102,204,0.06), 0 8px 24px rgba(0,102,204,0.08), 0 24px 48px rgba(0,102,204,0.06)",
            }}
          >
            <span
              className="absolute -top-3 left-6 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
              style={{
                background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)",
                boxShadow: "0 2px 6px rgba(0,102,204,0.3)",
              }}
            >
              Popular
            </span>
            <h3 className="font-semibold text-lg mb-1">Pro</h3>
            <div className="font-display text-4xl font-bold mb-4 tabular-nums">
              ৳২৬০<span className="text-base font-normal text-[var(--color-muted)]">/মাস</span>
            </div>
            <ul className="space-y-2 text-sm mb-6 font-bengali">
              {["৩টি পিক / দিন + বিশ্লেষণ", "পোর্টফোলিও P&L ট্র্যাকিং", "স্টক সার্চ + ২ বছরের চার্ট", "ব্রাউজার নোটিফিকেশন", "ট্র্যাক রেকর্ড অ্যাক্সেস"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <span className="text-[var(--foreground)]">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block text-center text-white font-semibold py-3 rounded-lg transition-all hover:shadow-[0_8px_24px_rgba(0,102,204,0.3)] text-sm"
              style={{
                background: "linear-gradient(135deg, #0066CC 0%, #0052A3 100%)",
                boxShadow: "0 2px 4px rgba(0,102,204,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              ৭ দিন ফ্রি ট্রায়াল →
            </Link>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-6 pb-8 max-w-3xl mx-auto">
        <p className="font-bengali text-xs text-[var(--color-muted)] text-center leading-relaxed">
          বিনিয়োগ ঝুঁকিপূর্ণ। Stock Peak শুধুমাত্র শিক্ষামূলক ও তথ্যভিত্তিক AI বিশ্লেষণ প্রদান করে। এটি বিনিয়োগ পরামর্শ নয়। সকল বিনিয়োগ সিদ্ধান্ত আপনার নিজের দায়িত্বে।
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-6 py-8 mt-auto">
        <div className="max-w-3xl mx-auto flex justify-between items-center text-sm text-[var(--color-muted)]">
          <span className="font-display font-semibold text-[var(--foreground)]">Stock Peak</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-[var(--foreground)] transition-colors">About</Link>
            <Link href="/disclaimer" className="hover:text-[var(--foreground)] transition-colors">Disclaimer</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
