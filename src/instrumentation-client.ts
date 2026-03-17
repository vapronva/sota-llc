import * as Sentry from "@sentry/nextjs";

import { sentryBaseConfig } from "~/lib/sentry-config";

Sentry.init({
  ...sentryBaseConfig,
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
