import * as Sentry from "@sentry/nextjs";

import { sentryConfig } from "~/lib/sentry-config";

Sentry.init(sentryConfig);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
