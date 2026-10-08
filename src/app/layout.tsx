import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";

import slides from "~/data/slides.json";
import { jetBrainsMono } from "~/styles/font";
import "~/styles/globals.css";

const [firstSlide] = slides;

export const metadata: Metadata = {
  metadataBase: new URL("https://sota.llc"),
  title: "SOTA",
  description: "Мы SOTA… потому что мы SOTA.",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    url: "/",
    siteName: "SOTA",
    type: "website",
    locale: "ru_RU",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
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
  children: ReactNode;
}>) {
  if (firstSlide) {
    preload(firstSlide.url, { as: "image", crossOrigin: "anonymous" });
  }
  return (
    <html lang="ru">
      <body className={`${jetBrainsMono.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
