/**
 * Minimal password gate for the landlord app.
 *
 * The public routes (/listings, /apply, /portal) stay open — tenants and
 * applicants need them. Everything else requires the password set in the
 * ADMIN_PASSWORD environment variable.
 *
 * Edge-runtime safe: uses Web Crypto only, so middleware can verify the cookie.
 */

export const SESSION_COOKIE = "opentenant_session";

/** Routes anyone may reach without logging in. */
export const PUBLIC_PREFIXES = ["/listings", "/apply", "/portal", "/login", "/robots.txt"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Derives the cookie value from the password. Knowing it proves you knew the password. */
export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("opentenant.session.v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish comparison so a wrong cookie can't be guessed byte by byte. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The password guarding the app, or "" when no gate is configured.
 * Locally (no ADMIN_PASSWORD set) the app is open so you can just run it;
 * set ADMIN_PASSWORD whenever it's reachable from the internet.
 */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}
