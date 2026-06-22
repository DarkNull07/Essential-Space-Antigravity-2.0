import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fzqnyzipoiuevosznoxg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/((?!api/|_next/|static/|favicon.ico).*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: https://fzqnyzipoiuevosznoxg.supabase.co https://www.google.com https://*.ytimg.com https://*.youtube.com;",
              "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com;",
              "connect-src 'self' https://fzqnyzipoiuevosznoxg.supabase.co wss://fzqnyzipoiuevosznoxg.supabase.co https://www.youtube.com;",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;",
              "media-src 'self';",
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
