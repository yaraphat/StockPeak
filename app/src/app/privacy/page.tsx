import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="font-display font-semibold text-lg">Stock Peak</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-6">গোপনীয়তা নীতি</h1>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 space-y-4 font-bengali text-sm leading-relaxed text-[var(--color-muted)]">
          <p><strong className="text-[var(--foreground)]">তথ্য সংগ্রহ:</strong> আমরা শুধুমাত্র আপনার ইমেইল, নাম এবং পেমেন্ট তথ্য সংগ্রহ করি। কোনো অপ্রয়োজনীয় ব্যক্তিগত তথ্য সংগ্রহ করা হয় না।</p>
          <p><strong className="text-[var(--foreground)]">তথ্য ব্যবহার:</strong> আপনার তথ্য শুধুমাত্র সেবা প্রদান, পিক ডেলিভারি এবং পেমেন্ট প্রক্রিয়াকরণের জন্য ব্যবহৃত হয়।</p>
          <p><strong className="text-[var(--foreground)]">তৃতীয় পক্ষ:</strong> আমরা আপনার ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের সাথে শেয়ার, বিক্রি বা ভাড়া দিই না।</p>
          <p><strong className="text-[var(--foreground)]">ডেটা নিরাপত্তা:</strong> সকল তথ্য এনক্রিপ্টেড সংযোগের (HTTPS) মাধ্যমে সংরক্ষিত ও প্রেরিত হয়।</p>
          <p><strong className="text-[var(--foreground)]">তথ্য মুছে ফেলা:</strong> আপনি যেকোনো সময় আপনার অ্যাকাউন্ট এবং সমস্ত সংশ্লিষ্ট তথ্য মুছে ফেলার অনুরোধ করতে পারেন।</p>
          <p><strong className="text-[var(--foreground)]">যোগাযোগ:</strong> গোপনীয়তা সম্পর্কিত যেকোনো প্রশ্নে আমাদের সাথে যোগাযোগ করুন: privacy@stockpeak.com.bd</p>
        </div>
      </main>
    </div>
  );
}
