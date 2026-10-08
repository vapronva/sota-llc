"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { jetBrainsMono } from "~/styles/font";
import "~/styles/globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="ru">
      <head>
        <title>Что-то пошло не так (sota.llc)</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${jetBrainsMono.variable} font-mono antialiased`}>
        <main className="p-safe-4 grid min-h-dvh place-items-center">
          <div className="grid w-full max-w-lg gap-4 text-center">
            <h1 className="text-2xl text-white">Произошла ошибка)</h1>
            <p className="text-white/80">
              Мы уже получили отчёт об ошибке... Вроде...
            </p>
            {error.digest ? (
              <p className="text-sm text-white/70">ID ошибки: {error.digest}</p>
            ) : null}
            <div>
              <button
                type="button"
                onClick={() => retry()}
                className="cursor-pointer rounded-lg border border-white/30 bg-white/8 px-4 py-2.5 text-white hover:bg-white/15 focus-visible:bg-white/15"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
