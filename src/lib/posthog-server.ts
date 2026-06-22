/**
 * Server-side PostHog client (posthog-node).
 *
 * Usage:
 *   import { posthogServer } from "@/lib/posthog-server";
 *   await posthogServer.capture({ distinctId: userId, event: "my_event", properties: { … } });
 *   await posthogServer.shutdown(); // flush before the serverless function exits
 *
 * Not wired into any route yet — import where needed for server-side events.
 */
import { PostHog } from "posthog-node";

// Lazily instantiate a module-level singleton so the client is reused across
// warm serverless invocations (Next.js server actions / route handlers).
let _client: PostHog | null = null;

function getPostHogServerClient(): PostHog {
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST, // direct to PostHog, not the /ingest proxy
      flushAt: 1,    // flush immediately in serverless environments
      flushInterval: 0,
    });
  }
  return _client;
}

export const posthogServer = getPostHogServerClient();
