import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Bengali, Fraunces } from "next/font/google";
import { AuthProvider } from "@/components/session-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stock Peak — AI Stock Picks for DSE",
  description:
    "প্রতিদিন সকালে AI-চালিত স্টক পিক পান। ঢাকা স্টক এক্সচেঞ্জের জন্য।",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      className={`${plusJakarta.variable} ${notoBengali.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
