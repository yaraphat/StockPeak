export interface GlossaryEntry {
  title: string;
  en: string;
  bn?: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  signal: {
    title: "Signal",
    en: "Our overall call on this stock right now. STRONG BUY/BUY = consider entering. HOLD = watch only. SELL/STRONG SELL = avoid or exit.",
    bn: "এই মুহূর্তে স্টকটির জন্য আমাদের পরামর্শ। BUY মানে কেনার সুযোগ, SELL মানে এড়িয়ে চলুন।",
  },
  score: {
    title: "Score",
    en: "Weighted score from multiple indicators. Positive = bullish, negative = bearish. Bigger number = stronger conviction.",
    bn: "একাধিক সূচক মিলিয়ে স্কোর। ধনাত্মক মানে উর্ধ্বমুখী, ঋণাত্মক মানে নিম্নমুখী।",
  },
  timeframe: {
    title: "Timeframe",
    en: "How long this trade plan is designed to hold. Swing = days to weeks.",
    bn: "এই ট্রেড প্ল্যান কতদিনের জন্য। সুইং মানে কয়েক দিন থেকে কয়েক সপ্তাহ।",
  },
  risk_tier: {
    title: "Your risk tier",
    en: "Your chosen risk level. Conservative = tighter stops, smaller position. Aggressive = wider stops, larger position.",
    bn: "আপনার ঝুঁকির মাত্রা। কনজারভেটিভ = কম ঝুঁকি, অ্যাগ্রেসিভ = বেশি ঝুঁকি।",
  },
  entry_zone: {
    title: "Entry zone (Buy)",
    en: "Price range where we suggest buying. Don't buy above the top of this range — the setup is no longer favorable there.",
    bn: "যে দামে কেনার পরামর্শ দিচ্ছি। এই রেঞ্জের উপরে কিনবেন না।",
  },
  target_1: {
    title: "Target 1 (T1)",
    en: "First profit-taking level. Sell half your shares here to lock in the first gain.",
    bn: "প্রথম লাভ তোলার জায়গা। এখানে অর্ধেক শেয়ার বিক্রি করুন।",
  },
  target_2: {
    title: "Target 2 (T2)",
    en: "Final profit-taking level. Sell the remaining shares here.",
    bn: "শেষ লাভ তোলার জায়গা। বাকি শেয়ার এখানে বিক্রি করুন।",
  },
  initial_stop: {
    title: "Initial stop",
    en: "If price drops to this level after you buy, sell immediately. This caps your loss. Never ignore the stop.",
    bn: "দাম এখানে নেমে এলে সাথে সাথেই বিক্রি করুন। এটি আপনার লোকসান সীমিত রাখে।",
  },
  risk_reward: {
    title: "Risk / Reward",
    en: "How much you can win vs. how much you risk. 2:1 means you risk ৳1 to make ৳2. Higher is better — avoid anything under 1.5:1.",
    bn: "লাভের সম্ভাবনা বনাম ঝুঁকি। ২:১ মানে ১ টাকা ঝুঁকিতে ২ টাকা লাভ। ১.৫ এর নিচে এড়িয়ে চলুন।",
  },
  stop_ladder: {
    title: "Stop-loss ladder",
    en: "As price rises, raise your stop step-by-step to protect profit. 'Breakeven' = move stop to your buy price (zero-risk trade). 'Lock +0.5R' = lock in half your initial risk as profit.",
    bn: "দাম বাড়লে ধাপে ধাপে স্টপ উপরে তুলুন, যাতে লাভ সুরক্ষিত থাকে।",
  },
  position_sizing: {
    title: "Position sizing",
    en: "How many shares to buy based on your risk tier. Sized so that if the stop hits, your loss is controlled (typically 1–2% of capital).",
    bn: "কতগুলো শেয়ার কিনবেন। স্টপ হিট হলে লোকসান সীমিত থাকবে এভাবে হিসাব করা।",
  },
  rsi: {
    title: "RSI (Relative Strength Index)",
    en: "Momentum gauge 0–100. Above 70 = overbought (may pull back). Below 30 = oversold (may bounce). 40–60 = neutral.",
    bn: "গতির মাপকাঠি, ০-১০০। ৭০ এর উপরে অতি-কেনা, ৩০ এর নিচে অতি-বিক্রি।",
  },
  macd: {
    title: "MACD histogram",
    en: "Trend momentum signal. Positive and rising = bullish momentum building. Negative and falling = bearish.",
    bn: "ট্রেন্ডের শক্তি। ধনাত্মক ও বাড়তে থাকলে উর্ধ্বমুখী শক্তি বাড়ছে।",
  },
  atr: {
    title: "ATR (Average True Range)",
    en: "Average daily price swing in taka. Used to size stops — bigger ATR means you need a wider stop to avoid getting shaken out.",
    bn: "দিনে গড়ে কত টাকা দাম উঠানামা করে। বেশি ATR মানে স্টপ চওড়া রাখতে হবে।",
  },
  ema_50: {
    title: "EMA 50",
    en: "Smoothed average price over the last 50 trading days. Price above EMA 50 = short-term uptrend.",
    bn: "গত ৫০ দিনের গড় দাম। দাম এর উপরে থাকলে স্বল্প-মেয়াদি ট্রেন্ড উর্ধ্বমুখী।",
  },
  ema_200: {
    title: "EMA 200",
    en: "Smoothed average price over the last 200 trading days. Price above EMA 200 = long-term uptrend. The big-picture direction.",
    bn: "গত ২০০ দিনের গড় দাম। দাম এর উপরে থাকলে দীর্ঘ-মেয়াদি ট্রেন্ড উর্ধ্বমুখী।",
  },
  volume_ratio: {
    title: "Volume ratio",
    en: "Today's volume vs. the 20-day average. 2× = twice as active as usual. Big price moves on high volume are more trustworthy.",
    bn: "আজকের ভলিউম বনাম ২০ দিনের গড়। ২× মানে স্বাভাবিকের দ্বিগুণ লেনদেন।",
  },
  support: {
    title: "Support",
    en: "Price level where buyers have stepped in before. Price often bounces from here. If it breaks, expect a bigger drop.",
    bn: "যেখান থেকে দাম আগে ফিরে গেছে। সাধারণত এখানে আবার কেনার চাপ আসে।",
  },
  resistance: {
    title: "Resistance",
    en: "Price level where sellers have stepped in before. Price often stalls here. A clean break above often triggers a strong rally.",
    bn: "যেখানে দাম আগে থেমেছে। এই লেভেল ভাঙলে আরও উপরে যেতে পারে।",
  },
  week_range: {
    title: "52-week range",
    en: "Highest and lowest price over the past year. Shows where current price sits in its yearly cycle.",
    bn: "গত এক বছরের সর্বোচ্চ এবং সর্বনিম্ন দাম।",
  },
  red_flags: {
    title: "Red flags",
    en: "Warning signs to consider before entering — category risk, liquidity issues, stale data, or unusual price action.",
    bn: "কেনার আগে সতর্ক হওয়ার বিষয়গুলো।",
  },
};
