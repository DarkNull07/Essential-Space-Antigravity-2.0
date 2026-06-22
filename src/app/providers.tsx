"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Initialise exactly once on the client (guards against double-init in strict mode).
if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,          // "/ingest" — same-origin proxy
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,        // "https://us.i.posthog.com"
    capture_pageview: "history_change",                       // SPA route-change pageviews
    capture_pageleave: true,
    capture_performance: { web_vitals: true },               // Core Web Vitals
    person_profiles: "identified_only",                       // profiles only for logged-in users
    session_recording: {
      maskAllInputs: true,                                    // mask every <input> by default
      maskTextSelector: ".ph-no-capture, [data-ph-mask]",    // also mask marked elements
    },
  });
}

/** Wires Supabase auth state → PostHog identity */
function PostHogAuthSync() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
        });
      }
      if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export function PHProvider({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PostHogAuthSync />
      {children}
    </PostHogProvider>
  );
}
