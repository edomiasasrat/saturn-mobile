import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple rate limiter: per-IP, sliding window
const requests = new Map<string, number[]>();
const RATE_LIMIT = 60; // max requests per window
const WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requests.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requests.set(ip, recent);
  // Cleanup old entries periodically
  if (requests.size > 1000) {
    for (const [key, vals] of requests) {
      if (vals.every((t) => now - t > WINDOW_MS)) requests.delete(key);
    }
  }
  return recent.length > RATE_LIMIT;
}

export function middleware(request: NextRequest) {
  // Only protect API mutation routes
  if (!request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const method = request.method;

  // Rate limit all API requests
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // CSRF: only check mutation methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  // Check origin/referer matches our host
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) return NextResponse.next();

  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`,
    // Allow localhost for development
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  const originMatch = origin && allowedOrigins.some((o) => origin.startsWith(o));
  const refererMatch = referer && allowedOrigins.some((o) => referer.startsWith(o));

  if (!originMatch && !refererMatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
