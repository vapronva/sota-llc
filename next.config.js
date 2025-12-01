import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: true,
};

export default withSentryConfig(config, {
  org: "cmld",
  project: "sota-llc",
  sentryUrl: "https://sentry.cumlord.ru/",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/mwah",
  disableLogger: true,
  automaticVercelMonitors: true,
});
