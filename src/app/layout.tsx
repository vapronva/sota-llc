import type React from "react";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { preload } from "react-dom";

import slides from "~/data/slides.json";
import "~/styles/globals.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic", "latin-ext"],
  variable: "--font-jetbrains-mono",
});

const firstSlideUrl = slides[0]!.url;

export const metadata: Metadata = {
  metadataBase: new URL("https://sota.llc"),
  title: "SOTA",
  description: "Мы SOTA… потому что мы SOTA.",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "SOTA",
    description: "Мы SOTA… потому что мы SOTA.",
    url: "https://sota.llc",
    siteName: "SOTA",
    type: "website",
    locale: "ru_RU",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOTA",
    description: "Мы SOTA… потому что мы SOTA.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  preload(firstSlideUrl, { as: "image", crossOrigin: "anonymous" });
  return (
    <html lang="ru">
      <body className={`${jetBrainsMono.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
