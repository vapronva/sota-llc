import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const config: NextConfig = {
  output: "standalone",
  compiler: {
    define: {
      __SENTRY_DEBUG__: false,
    },
  },
};

export default withSentryConfig(config, {
  org: "cmld",
  project: "sota-llc",
  sentryUrl: "https://sentry.cumlord.ru/",
});
