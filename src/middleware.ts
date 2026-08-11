import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authGateEnabled, isPublicPath, readSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // Neither a password nor Google sign-in is configured — the app runs open
  // (fine on your own machine, not fine on a public host).
  if (!authGateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const identity = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (identity) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next internals and static files; guard everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
