import type React from "react";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

import "~/styles/globals.css";

const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sota.llc"),
  title: "SOTA",
  description: "Мы SOTA... потому что мы SOTA.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistMono.className} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
