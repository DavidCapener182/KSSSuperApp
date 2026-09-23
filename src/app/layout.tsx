import type { Metadata } from "next";
import "./globals.css";
import { isStaging } from "@/lib/environment-label";

export const metadata: Metadata = {
  title: "KSS Enterprise Platform",
  description: "KSS Enterprise Platform development foundation",
  robots: isStaging ? { index: false, follow: false, nocache: true } : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
