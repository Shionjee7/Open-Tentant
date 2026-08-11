/**
 * Who may reach the landlord app.
 *
 * Two ways in, and either is enough:
 *
 * 1. **Google sign-in** — the friendly one. Standard OAuth 2.0 against Google
 *    directly (no PocketBase or third-party library involved), gated by an
 *    email allowlist so only people you name can get in.
 * 2. **Shared password** — set ADMIN_PASSWORD and anyone with it can sign in.
 *    Useful when you'd rather not involve Google at all.
 *
 * Both are configured through environment variables, never through the
 * Settings UI — that keeps the login gate checkable in Edge middleware
 * without a database round trip, so a database outage can't accidentally
 * unlock the app.
 *
 * Public routes (/listings, /apply, /portal) never require either.
 *
 * Sessions are HMAC-signed cookies so the Edge middleware can check them
 * without touching the database on every request.
 */

export const SESSION_COOKIE = "opentenant_session";
export const OAUTH_STATE_COOKIE = "opentenant_oauth_state";

/**
 * Routes anyone may reach without signing in.
 *
 * The OpenSign webhook is here because it's called by OpenSign's servers, which
 * have no session cookie — it authenticates itself with a shared secret header
 * instead. Without this, signature-completion callbacks would be bounced to the
 * login page and silently lost.
 */
export const PUBLIC_PREFIXES = [
  "/listings",
  "/apply",
  "/portal",
  "/login",
  "/api/auth",
  "/api/opensign/webhook",
  "/robots.txt",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Secret used to sign sessions and OAuth state. Prefers AUTH_SECRET;
 * otherwise derives one from whichever credential the install already has,
 * so sessions work with no extra configuration.
 */
function signingSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.PB_ADMIN_PASSWORD?.trim() ||
    "opentenant-local-dev"
  );
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 86400;

/**
 * Identities are base64url-encoded before signing. Emails contain dots, and the
 * cookie is dot-delimited — encoding keeps the three parts unambiguous.
 */
function encodeIdentity(identity: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(identity)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeIdentity(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Builds a signed session cookie for a signed-in identity (an email, or "admin"). */
export async function createSession(identity: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `${encodeIdentity(identity)}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the identity in a session cookie, or null if absent/invalid/expired. */
export async function readSession(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [encoded, expires, signature] = parts;

  const expected = await hmac(`${encoded}.${expires}`);
  if (!safeEqual(signature, expected)) return null;
  if (!Number(expires) || Number(expires) < Date.now()) return null;

  return decodeIdentity(encoded);
}

// ---------- Password gate ----------

/** The shared password, or "" when none is set. */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

// ---------- Google sign-in ----------

export function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

/** Both halves of the OAuth credential are present. */
export function googleCredentialsConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

function allowedGoogleEmails(): string[] {
  return (process.env.GOOGLE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function googleAllowlistCount(): number {
  return allowedGoogleEmails().length;
}

/**
 * Google sign-in is usable: credentials are set *and* at least one email is
 * allowlisted. Without an allowlist, every successful Google login would be
 * rejected anyway, so the button stays hidden until both are configured.
 */
export function googleSignInEnabled(): boolean {
  return googleCredentialsConfigured() && googleAllowlistCount() > 0;
}

export function isEmailAllowed(email: string): boolean {
  return allowedGoogleEmails().includes(email.trim().toLowerCase());
}

/** True once either sign-in method would actually block unauthenticated access. */
export function authGateEnabled(): boolean {
  return Boolean(adminPassword()) || googleSignInEnabled();
}

/** Only ever redirect back into the app itself, never off-site. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
