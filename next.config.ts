import type { NextConfig } from "next";

// Derive the Supabase hostname from the env var at build time so it never goes
// stale if the project changes. Falls back to a clear error string that will
// visibly break CSP/image loading rather than silently using a wrong hostname.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "MISSING_NEXT_PUBLIC_SUPABASE_URL";

const nextConfig: NextConfig = {
  // Required so that /ingest/:path* rewrites work without Next.js
  // appending a trailing slash and breaking the proxy path match.
  skipTrailingSlashRedirect: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // ── PostHog same-origin reverse proxy ────────────────────────────────────
  // Proxying of /ingest/* requests is handled in src/middleware.ts.
  // This keeps analytics within the same origin so:
  //   (a) connect-src 'self' covers event ingestion without loosening the CSP.
  //   (b) the proxy is transparent to browser-based ad-blockers.


  async headers() {
    return [
      {
        source: "/((?!api/|_next/|static/|favicon.ico).*)",
        headers: [
          {
            // Enforced CSP (was Report-Only). Supabase hostname is derived from
            // NEXT_PUBLIC_SUPABASE_URL at build time — not hardcoded.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
              "style-src 'self' 'unsafe-inline';",
              `img-src 'self' data: https://${supabaseHostname} https://www.google.com https://*.gstatic.com https://*.ytimg.com https://*.youtube.com;`,
              "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com;",
              // 'self' covers /ingest/* proxy so no external PostHog origin needed.
              `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname} https://www.youtube.com;`,
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;",
              "media-src 'self';",
              // PostHog session-replay recorder runs in a Web Worker sourced from a
              // blob: URL. Allow blob: under worker-src to prevent CSP violations.
              "worker-src 'self' blob:;",
              "object-src 'none';",
              "frame-ancestors 'none';",
              "base-uri 'self';",
              "form-action 'self';",
            ].join(" "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
