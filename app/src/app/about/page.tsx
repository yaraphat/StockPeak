import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-6">Stock Peak সম্পর্কে</h1>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
          <p className="font-bengali text-sm leading-relaxed text-[var(--color-muted)]">
            Stock Peak একটি AI-চালিত স্টক বিশ্লেষণ প্ল্যাটফর্ম, বিশেষভাবে ঢাকা স্টক এক্সচেঞ্জ (DSE) এর জন্য তৈরি। আমরা প্রতিদিন সকালে ৩টি AI-বিশ্লেষিত স্টক পিক প্রদান করি, যাতে ব্যস্ত পেশাজীবীরা সহজে বিনিয়োগ সিদ্ধান্ত নিতে পারেন।
          </p>

          <h2 className="font-display text-lg font-semibold pt-2">আমাদের পদ্ধতি</h2>
          <p className="font-bengali text-sm leading-relaxed text-[var(--color-muted)]">
            আমাদের AI সিস্টেম প্রতিদিন ৪০০+ DSE-তালিকাভুক্ত স্টক বিশ্লেষণ করে। টেকনিক্যাল ইন্ডিকেটর (RSI, MACD, Moving Averages, Volume Analysis) এবং সেক্টর মোমেন্টাম বিশ্লেষণের মাধ্যমে সেরা ৩টি সুযোগ বাছাই করা হয়।
          </p>

          <h2 className="font-display text-lg font-semibold pt-2">স্বচ্ছতা</h2>
          <p className="font-bengali text-sm leading-relaxed text-[var(--color-muted)]">
            প্রতিটি পিকের ফলাফল স্বয়ংক্রিয়ভাবে ট্র্যাক করা হয়। আমাদের{" "}
            <Link href="/track-record" className="text-[var(--color-primary)] underline">Track Record</Link>{" "}
            পৃষ্ঠায় সম্পূর্ণ পারফরম্যান্স ইতিহাস দেখতে পাবেন — সফলতা এবং ব্যর্থতা উভয়ই।
          </p>
        </div>
      </main>
    </div>
  );
}
