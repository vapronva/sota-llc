import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default withSentryConfig(config, {
  org: "cmld",
  project: "sota-llc",
  sentryUrl: "https://sentry.cumlord.ru/",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
