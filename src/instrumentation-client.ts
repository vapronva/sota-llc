import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://2a94e48d3b3570f2b936780d236a9656@sentry.cumlord.ru/75",
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
