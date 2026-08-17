import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const sz = searchParams.get("sz") || "64";

  if (!domain || !domain.trim()) {
    return new NextResponse("Domain parameter is required", { status: 400 });
  }

  try {
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain.trim())}&sz=${encodeURIComponent(sz)}`;
    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!res.ok) {
      return new NextResponse("Favicon not found", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const arrayBuffer = await res.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    console.error("Favicon proxy error:", error);
    return new NextResponse("Failed to fetch favicon", { status: 502 });
  }
}
