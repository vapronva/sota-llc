import type React from "react";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

import "~/styles/globals.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic", "latin-ext"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sota.llc"),
  title: "SOTA",
  description: "Мы SOTA... потому что мы SOTA.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "SOTA",
    description: "Мы SOTA... потому что мы SOTA.",
    url: "https://sota.llc",
    siteName: "SOTA",
    type: "website",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary",
    title: "SOTA",
    description: "Мы SOTA... потому что мы SOTA.",
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
  return (
    <html lang="ru">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.engineering"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://cdn.engineering/hidetohyde/pixiv/130823834_p1.jpg"
          as="image"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${jetBrainsMono.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
