"use client";

import * as Sentry from "@sentry/nextjs";
import { JetBrains_Mono } from "next/font/google";
import { useEffect } from "react";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic", "latin-ext"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="ru">
      <head>
        <title>Что-то пошло не так (sota.llc)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          @keyframes grain-shift {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -10%); }
            30% { transform: translate(7%, -25%); }
            50% { transform: translate(-15%, 10%); }
            70% { transform: translate(0%, 15%); }
            90% { transform: translate(-10%, 10%); }
          }
          .grain-overlay { position: relative; }
          .grain-overlay::before {
            content: "";
            position: fixed;
            inset: -100%;
            width: 300%;
            height: 300%;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 256px 256px;
            opacity: 0.04;
            pointer-events: none;
            animation: grain-shift 0.4s steps(8) infinite;
            z-index: 100;
          }
          @media (prefers-reduced-motion: reduce) {
            .grain-overlay::before { animation: none; opacity: 0.03; }
          }
        `}</style>
      </head>
      <body
        className={`${jetBrainsMono.className} grain-overlay`}
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          padding: "1rem",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "34rem",
            textAlign: "center",
            display: "grid",
            gap: "1rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", lineHeight: 1.3 }}>
            Произошла ошибка)
          </h1>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Мы уже получили отчёт об ошибке... Вроде...
          </p>
          {error.digest ? (
            <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.7 }}>
              ID ошибки: {error.digest}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: "1px solid rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.08)",
                color: "inherit",
                borderRadius: "0.5rem",
                padding: "0.625rem 1rem",
                cursor: "pointer",
              }}
            >
              Попробовать снова
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
