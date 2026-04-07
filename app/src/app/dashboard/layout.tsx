import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Stock Peak",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
