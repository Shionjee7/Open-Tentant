import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, googleClientId, googleCredentialsConfigured, safeNextPath } from "@/lib/auth";

/**
 * Kicks off Google sign-in: redirects to Google's consent screen.
 *
 * Plain OAuth 2.0 authorization-code flow against Google's own endpoints —
 * no library, no PocketBase involvement. The state value is stored in a
 * short-lived cookie and compared on the way back, which is the standard
 * defense against an attacker replaying their own authorization code into a
 * victim's browser (login CSRF).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!googleCredentialsConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", url.origin));
  }

  const next = safeNextPath(url.searchParams.get("next"));
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleClientId());
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}:${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
