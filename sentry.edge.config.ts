import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://2a94e48d3b3570f2b936780d236a9656@sentry.cumlord.ru/75",
  tracesSampleRate: 1,
  sendDefaultPii: true,
});
