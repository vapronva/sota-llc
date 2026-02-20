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
        <title>Что-то пошло не так | SOTA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={jetBrainsMono.className}
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
