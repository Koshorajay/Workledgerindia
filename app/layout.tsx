import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "WorkLedger",
  description:
    "Work management.",
  icons: { icon: "/favicon.svg?v=2" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
