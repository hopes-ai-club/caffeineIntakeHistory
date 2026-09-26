import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "カフェイン摂取管理",
  description: "毎日のカフェイン摂取量と体内の推定残存量を記録・確認できるアプリです。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full bg-bg-canvas antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-canvas font-sans text-text-primary">{children}</body>
    </html>
  );
}
