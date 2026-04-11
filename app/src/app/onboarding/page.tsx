"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 5 questions, each with 3 answers scored 0 (conservative) / 1 (moderate) / 2 (aggressive)
const QUESTIONS = [
  {
    id: 0,
    question: "আপনি কতদিনের জন্য বিনিয়োগ করতে চান?",
    question_en: "How long do you plan to keep your investments?",
    options: [
      { label: "১ বছরের কম", label_en: "Less than 1 year", score: 0 },
      { label: "১-৩ বছর", label_en: "1 to 3 years", score: 1 },
      { label: "৩ বছরের বেশি", label_en: "More than 3 years", score: 2 },
    ],
  },
  {
    id: 1,
    question: "আপনার পোর্টফোলিও ২০% কমে গেলে আপনি কী করবেন?",
    question_en: "If your portfolio dropped 20%, what would you do?",
    options: [
      { label: "সব বিক্রি করে দেব", label_en: "Sell everything", score: 0 },
      { label: "অপেক্ষা করব", label_en: "Wait and hold", score: 1 },
      { label: "আরও কিনব", label_en: "Buy more", score: 2 },
    ],
  },
  {
    id: 2,
    question: "শেয়ার বাজারে আপনার অভিজ্ঞতা কতটুকু?",
    question_en: "How much experience do you have investing in the stock market?",
    options: [
      { label: "কোনো অভিজ্ঞতা নেই", label_en: "No experience", score: 0 },
      { label: "কিছুটা অভিজ্ঞতা আছে", label_en: "Some experience", score: 1 },
      { label: "অনেক অভিজ্ঞতা আছে", label_en: "Experienced investor", score: 2 },
    ],
  },
  {
    id: 3,
    question: "আপনার বিনিয়োগের মূল লক্ষ্য কী?",
    question_en: "What is your primary investment goal?",
    options: [
      { label: "মূলধন সংরক্ষণ", label_en: "Preserve capital", score: 0 },
      { label: "স্থির আয়", label_en: "Steady income", score: 1 },
      { label: "সর্বোচ্চ বৃদ্ধি", label_en: "Maximum growth", score: 2 },
    ],
  },
  {
    id: 4,
    question: "আপনি মোট কত টাকা বিনিয়োগ করতে চান?",
    question_en: "How much do you plan to invest in total?",
    options: [
      { label: "৳৫০,০০০ এর কম", label_en: "Less than ৳50,000", score: 0 },
      { label: "৳৫০,০০০ – ৳৫ লক্ষ", label_en: "৳50,000 – ৳5 lakh", score: 1 },
      { label: "৳৫ লক্ষের বেশি", label_en: "More than ৳5 lakh", score: 2 },
    ],
  },
];

const TIER_LABELS: Record<string, { label: string; label_bn: string; color: string; description: string }> = {
  conservative: {
    label: "Conservative",
    label_bn: "রক্ষণশীল বিনিয়োগকারী",
    color: "#0066CC",
    description: "Low risk. Focus on capital preservation with STRONG BUY signals only.",
  },
  moderate: {
    label: "Moderate",
    label_bn: "মধ্যম বিনিয়োগকারী",
    color: "#D97706",
    description: "Balanced approach. BUY and STRONG BUY signals with standard stop-losses.",
  },
  aggressive: {
    label: "Aggressive",
    label_bn: "আক্রমণাত্মক বিনিয়োগকারী",
    color: "#DC2626",
    description: "High risk tolerance. Wider stop-losses, higher targets, more picks.",
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(5).fill(-1));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ risk_tier: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progress = (currentQ / QUESTIONS.length) * 100;
  const allAnswered = answers.every((a) => a !== -1);

  function selectAnswer(score: number) {
    const updated = [...answers];
    updated[currentQ] = score;
    setAnswers(updated);

    // Auto-advance after a short delay
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((q) => q + 1);
      }
    }, 350);
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/risk-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(`Profile already set. ${data.days_remaining} days until you can change it.`);
        } else {
          setError(data.error || "Something went wrong");
        }
        setSubmitting(false);
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (result) {
    const tier = TIER_LABELS[result.risk_tier] || TIER_LABELS.moderate;
    return (
      <div className="min-h-screen bg-[#F8F6F4] flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#E7E5E4] p-8 text-center" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <div
            className="inline-block px-4 py-1.5 rounded-full text-white text-sm font-semibold mb-4"
            style={{ backgroundColor: tier.color }}
          >
            {tier.label}
          </div>
          <h1 className="font-display text-2xl font-semibold mb-2">
            {tier.label_bn}
          </h1>
          <p className="text-[#78716C] text-sm mb-6">{tier.description}</p>
          <p className="text-xs text-[#A8A29E] mb-8">
            আপনার প্রোফাইল সেভ হয়েছে। ৩০ দিনের আগে পরিবর্তন করা যাবে না।
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm"
            style={{ backgroundColor: "#0066CC" }}
          >
            ড্যাশবোর্ডে যান →
          </button>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[currentQ];

  return (
    <div className="min-h-screen bg-[#F8F6F4] flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-semibold text-lg text-[#1C1917]">
            Stock Peak
          </Link>
          <p className="text-[#78716C] text-sm mt-1">রিস্ক প্রোফাইল কুইজ</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-[#78716C] mb-2">
            <span>প্রশ্ন {currentQ + 1} / {QUESTIONS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-[#E7E5E4] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0066CC] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-6 mb-4" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <p className="font-bengali text-lg font-semibold text-[#1C1917] mb-1 leading-relaxed">
            {q.question}
          </p>
          <p className="text-[#78716C] text-xs mb-6">{q.question_en}</p>

          <div className="space-y-3">
            {q.options.map((opt) => {
              const isSelected = answers[currentQ] === opt.score;
              return (
                <button
                  key={opt.score}
                  onClick={() => selectAnswer(opt.score)}
                  className="w-full text-left px-4 py-3 rounded-lg border transition-all duration-150"
                  style={{
                    borderColor: isSelected ? "#0066CC" : "#E7E5E4",
                    backgroundColor: isSelected ? "rgba(0,102,204,0.06)" : "transparent",
                    color: isSelected ? "#0066CC" : "#1C1917",
                  }}
                >
                  <span className="font-bengali text-sm font-medium block">{opt.label}</span>
                  <span className="text-xs text-[#78716C]">{opt.label_en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mb-4">
          {currentQ > 0 && (
            <button
              onClick={() => setCurrentQ((q) => q - 1)}
              className="flex-1 py-3 rounded-lg border border-[#E7E5E4] text-sm text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
            >
              ← আগে
            </button>
          )}
          {currentQ < QUESTIONS.length - 1 && answers[currentQ] !== -1 && (
            <button
              onClick={() => setCurrentQ((q) => q + 1)}
              className="flex-1 py-3 rounded-lg border border-[#0066CC] text-[#0066CC] text-sm font-medium hover:bg-[rgba(0,102,204,0.04)] transition-colors"
            >
              পরবর্তী →
            </button>
          )}
        </div>

        {/* Submit — only shown on last question when all answered */}
        {currentQ === QUESTIONS.length - 1 && allAnswered && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-opacity"
            style={{
              backgroundColor: "#0066CC",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন →"}
          </button>
        )}

        {error && (
          <p className="text-[#DC2626] text-sm text-center mt-4">{error}</p>
        )}

        {/* Quick navigation dots */}
        <div className="flex justify-center gap-2 mt-6">
          {QUESTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor:
                  i === currentQ ? "#0066CC" : answers[i] !== -1 ? "#0066CC40" : "#E7E5E4",
                transform: i === currentQ ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
