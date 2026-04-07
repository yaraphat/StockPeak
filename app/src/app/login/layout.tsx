import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Stock Peak",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
