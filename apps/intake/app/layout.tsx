import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
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
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "カフェインログ",
  },
};

export const viewport: Viewport = {
  themeColor: "#17130F",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full bg-bg-canvas antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-canvas font-sans text-text-primary">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
