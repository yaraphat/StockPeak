import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-6">বিনিয়োগ ঝুঁকি বিবরণী</h1>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4 font-bengali text-sm leading-relaxed text-[var(--color-muted)]">
          <p>
            <strong className="text-[var(--foreground)]">গুরুত্বপূর্ণ:</strong> Stock Peak শুধুমাত্র শিক্ষামূলক ও তথ্যভিত্তিক AI বিশ্লেষণ প্রদান করে। এটি কোনোভাবেই বিনিয়োগ পরামর্শ, আর্থিক পরামর্শ, বা ট্রেডিং সুপারিশ নয়।
          </p>
          <p>
            শেয়ার বাজারে বিনিয়োগ ঝুঁকিপূর্ণ। আপনার বিনিয়োগের মূল্য বাড়তেও পারে, কমতেও পারে। অতীতের পারফরম্যান্স ভবিষ্যতের ফলাফলের কোনো নিশ্চয়তা নয়।
          </p>
          <p>
            Stock Peak-এর AI সিস্টেম টেকনিক্যাল ইন্ডিকেটর এবং ঐতিহাসিক তথ্যের ভিত্তিতে বিশ্লেষণ করে। এই বিশ্লেষণে ত্রুটি থাকতে পারে এবং এটি সঠিক হওয়ার কোনো গ্যারান্টি নেই।
          </p>
          <p>
            সকল বিনিয়োগ সিদ্ধান্ত আপনার নিজের দায়িত্বে। বিনিয়োগের আগে একজন লাইসেন্সধারী আর্থিক উপদেষ্টার সাথে পরামর্শ করুন।
          </p>
          <p>
            Stock Peak বাংলাদেশ সিকিউরিটিজ অ্যান্ড এক্সচেঞ্জ কমিশন (BSEC) কর্তৃক নিবন্ধিত বিনিয়োগ উপদেষ্টা নয়। BSEC নিবন্ধন প্রক্রিয়া চলমান।
          </p>
        </div>
      </main>
    </div>
  );
}
