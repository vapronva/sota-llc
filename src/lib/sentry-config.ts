export const SENTRY_DSN =
  "https://2a94e48d3b3570f2b936780d236a9656@sentry.cumlord.ru/75";

export const sentryBaseConfig = {
  dsn: SENTRY_DSN,
  tracesSampleRate: 1,
  sendDefaultPii: true,
} as const;
