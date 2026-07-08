import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  if (request.headers.has("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 400 });
  }

  // ── PostHog same-origin reverse proxy ────────────────────────────────────
  // Proxy /ingest/* requests to PostHog with the correct Host header.
  // This bypasses the Supabase auth checks and fixes Vercel 400/503 errors.
  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/ingest")) {
    const isStaticOrArray =
      url.pathname.startsWith("/ingest/static/") ||
      url.pathname.startsWith("/ingest/array/");
    const hostname = isStaticOrArray
      ? "us-assets.i.posthog.com"
      : "us.i.posthog.com";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("host", hostname);

    url.protocol = "https";
    url.hostname = hostname;
    url.port = "443";
    url.pathname = url.pathname.replace(/^\/ingest/, "");

    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";

  // Redirect to login if user is not authenticated and trying to access a protected page
  if (!user && !isLoginPage) {
    if (request.nextUrl.pathname.startsWith("/api")) {
      const apiResponse = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
          apiResponse.headers.append(key, value);
        }
      });
      return apiResponse;
    }
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        redirectResponse.headers.append(key, value);
      }
    });
    return redirectResponse;
  }

  // Redirect to home if user is authenticated and trying to access login page
  if (user && isLoginPage) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        redirectResponse.headers.append(key, value);
      }
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static   (static files)
     * - _next/image    (image optimization)
     * - favicon.ico    (favicon)
     * - auth/callback  (auth flow redirects)
     * - public files   (svg, png, jpg, jpeg, gif, webp)
     * Note: /ingest/* is matched so that the middleware proxy catches it.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
