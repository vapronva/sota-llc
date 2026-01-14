import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  } else {
    throw new Error(
      `[Sentry] Unsupported or undefined NEXT_RUNTIME: "${process.env.NEXT_RUNTIME}". Expected "nodejs" or "edge". Sentry will not be initialized.`,
    );
  }
}

export const onRequestError = Sentry.captureRequestError;
