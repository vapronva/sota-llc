import type { NodeOptions } from "@sentry/nextjs";

export const sentryConfig = {
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://2a94e48d3b3570f2b936780d236a9656@sentry.cumlord.ru/75",
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
} satisfies NodeOptions;
