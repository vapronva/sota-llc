import * as Sentry from "@sentry/nextjs";

import { sentryClientConfig } from "~/lib/sentry-config";

Sentry.init({
  ...sentryClientConfig,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
