import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessPassword, accessToken, safeEqual } from "@/lib/access";

// Paths that must stay reachable without the access cookie.
const PUBLIC_PREFIXES = [
  "/login",
  "/api/version", // build id only; polled cross-origin by the update prompt
  "/api/cron/", // protected by CRON_SECRET instead
];

export async function middleware(req: NextRequest) {
  const password = accessPassword();
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and static files (anything with a file extension).
  matcher: ["/((?!_next/|images/|favicon|icon\\.svg|.*\\.[a-zA-Z0-9]+$).*)"],
};
