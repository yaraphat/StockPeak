import Link from "next/link";

const samplePicks = [
  {
    ticker: "DAFODILCOM",
    nameBn: "ড্যাফোডিল কমিউনিকেশনস",
    price: 85.1,
    target: 93.0,
    gain: 9.28,
    confidence: 8,
  },
  {
    ticker: "EGEN",
    nameBn: "ইজেনারেশন লিমিটেড",
    price: 22.1,
    target: 24.0,
    gain: 8.6,
    confidence: 7,
  },
  {
    ticker: "TILIL",
    nameBn: "তিতাস গ্যাস ট্রান্সমিশন",
    price: 45.9,
    target: 50.0,
    gain: 8.93,
    confidence: 6,
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="px-6 pt-20 pb-16 max-w-3xl mx-auto text-center">
        <span className="inline-block bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1 rounded-full mb-6">
          AI-Powered DSE Analysis
        </span>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
          প্রতিদিন সকালে স্মার্ট
          <br />
          স্টক পিক পান
        </h1>
        <p className="font-bengali text-lg text-[var(--color-muted)] max-w-xl mx-auto mb-8 leading-relaxed">
          AI বিশ্লেষণের মাধ্যমে প্রতিদিন সকাল ১০:৩০টায় ৩টি সেরা DSE স্টক পিক পান।
          বাই জোন, টার্গেট, স্টপ-লস, পোর্টফোলিও P&L ট্র্যাকিং এবং বিস্তারিত বিশ্লেষণসহ।
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/signup"
            className="bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold px-6 py-3 rounded-lg transition-opacity"
          >
            ৭ দিন ফ্রি ট্রায়াল শুরু করুন
          </Link>
          <Link
            href="#picks"
            className="border border-[var(--color-border)] font-semibold px-6 py-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            Sample Picks দেখুন
          </Link>
        </div>
      </section>

      {/* Sample Picks */}
      <section id="picks" className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-display text-xl font-semibold">Today&apos;s Picks</h2>
            <span className="text-sm text-[var(--color-muted)]">Sample Preview</span>
          </div>

          {/* Market Mood */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--color-border)]" style={{ background: "rgba(22,163,74,0.06)" }}>
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
            <span className="font-semibold text-[var(--color-success)] text-sm">Bullish</span>
            <span className="text-sm text-[var(--color-muted)]">Banking sector momentum + positive DSEX trend</span>
          </div>

          {/* Picks */}
          <div className="p-4 space-y-3">
            {samplePicks.map((pick) => (
              <div key={pick.ticker} className="border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-mono text-[var(--color-primary)] font-medium text-sm">{pick.ticker}</span>
                    <p className="font-bengali text-xs text-[var(--color-muted)]">{pick.nameBn}</p>
                  </div>
                  <div className="text-right font-mono tabular-nums text-sm">
                    <div className="font-medium">৳{pick.price.toFixed(2)}</div>
                    <div className="text-xs text-[var(--color-muted)]">Target: ৳{pick.target.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border-subtle)]">
                  <span className="text-[var(--color-success)] font-semibold text-sm">+{pick.gain}% upside</span>
                  <span className="text-xs text-[var(--color-muted)] font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                    {pick.confidence}/10 {pick.confidence >= 7 ? "High" : "Moderate"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Scorecard */}
          <div className="mx-4 mb-4 p-4 bg-[var(--background)] rounded-lg grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-2xl font-medium text-[var(--color-success)] tabular-nums">62%</div>
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Hit Rate</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-medium tabular-nums">43</div>
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Total Picks</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-medium text-[var(--color-success)] tabular-nums">+7.2%</div>
              <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">Avg Gain</div>
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

      {/* Pricing */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl font-semibold mb-8 text-center">Pricing</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-1">Free</h3>
            <div className="font-display text-3xl font-bold mb-4">৳০</div>
            <ul className="space-y-2 text-sm text-[var(--color-muted)] mb-6 font-bengali">
              <li>১টি পিক / দিন (বিলম্বিত)</li>
              <li>বিশ্লেষণ ছাড়া</li>
              <li>ওয়েব ড্যাশবোর্ড</li>
            </ul>
            <Link href="/signup" className="block text-center border border-[var(--color-border)] font-semibold py-2.5 rounded-lg hover:bg-[var(--background)] transition-colors text-sm">
              Sign Up Free
            </Link>
          </div>
          <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)] rounded-xl p-6 relative">
            <span className="absolute -top-3 left-6 bg-[var(--color-primary)] text-white text-xs font-semibold px-3 py-1 rounded-full">Popular</span>
            <h3 className="font-semibold text-lg mb-1">Pro</h3>
            <div className="font-display text-3xl font-bold mb-4">
              ৳২৬০<span className="text-base font-normal text-[var(--color-muted)]">/মাস</span>
            </div>
            <ul className="space-y-2 text-sm text-[var(--color-muted)] mb-6 font-bengali">
              <li>৩টি পিক / দিন + বিশ্লেষণ</li>
              <li>পোর্টফোলিও P&L ট্র্যাকিং</li>
              <li>স্টক সার্চ + ২ বছরের চার্ট</li>
              <li>ব্রাউজার নোটিফিকেশন</li>
              <li>ট্র্যাক রেকর্ড অ্যাক্সেস</li>
            </ul>
            <Link href="/signup" className="block text-center bg-[var(--color-primary)] hover:opacity-90 text-white font-semibold py-2.5 rounded-lg transition-opacity text-sm">
              ৭ দিন ফ্রি ট্রায়াল
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
