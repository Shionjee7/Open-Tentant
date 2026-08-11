import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  googleCredentialsConfigured,
  isEmailAllowed,
  safeNextPath,
} from "@/lib/auth";

/**
 * Google's redirect target after the consent screen. Exchanges the
 * authorization code for a token, looks up the signed-in Google account's
 * email, and — only if that email is on GOOGLE_ALLOWED_EMAILS — issues our
 * own session cookie. Everyone else's Google login is rejected here: being a
 * real Google account is not the same as being authorized for this app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const stored = store.get(OAUTH_STATE_COOKIE)?.value ?? "";
  store.delete(OAUTH_STATE_COOKIE);
  const [storedState, storedNext] = stored.split(":");
  const next = safeNextPath(storedNext ? decodeURIComponent(storedNext) : "/");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (oauthError) return fail("google_denied");
  if (!code || !state || !storedState || state !== storedState) return fail("google_state");
  if (!googleCredentialsConfigured()) return fail("google_not_configured");

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  if (!tokenResponse?.ok) return fail("google_token");
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("google_token");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);

  if (!profileResponse?.ok) return fail("google_userinfo");
  const profile = (await profileResponse.json()) as {
    email?: string;
    email_verified?: boolean;
  };
  const email = (profile.email ?? "").toLowerCase();

  if (!email || profile.email_verified === false) return fail("google_userinfo");
  if (!isEmailAllowed(email)) return fail("google_not_allowed");

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.set(SESSION_COOKIE, await createSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
