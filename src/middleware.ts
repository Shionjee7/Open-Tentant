import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, adminPassword, isPublicPath, safeEqual, sessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const password = adminPassword();
  // No password configured — the app runs open (fine on your own machine).
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const expected = await sessionToken(password);
  if (cookie && safeEqual(cookie, expected)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals and static files; guard everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
