import * as Sentry from "@sentry/nextjs";

import { sentryBaseConfig } from "~/lib/sentry-config";

Sentry.init(sentryBaseConfig);
