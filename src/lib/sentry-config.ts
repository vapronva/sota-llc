import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

export const sentryBaseConfig = {
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://2a94e48d3b3570f2b936780d236a9656@sentry.cumlord.ru/75",
  tracesSampleRate: 1.0,
} satisfies NodeOptions;

export const sentryClientConfig = {
  ...sentryBaseConfig,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
} satisfies BrowserOptions;
