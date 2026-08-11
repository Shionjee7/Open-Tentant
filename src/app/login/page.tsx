import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  adminPassword,
  createSession,
  googleSignInEnabled,
  safeEqual,
  safeNextPath,
} from "@/lib/auth";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";
  const password = adminPassword();
  const submitted = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!password || !safeEqual(submitted, password)) {
    redirect(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSession("admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next);
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up yet.",
  google_denied: "Sign-in was cancelled.",
  google_state: "That sign-in link expired — try again.",
  google_token: "Google didn't confirm the sign-in — try again.",
  google_userinfo: "Couldn't verify your Google account — try again.",
  google_not_allowed: "That Google account isn't authorized for this app.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = safeNextPath(next);
  const passwordError = error === "1";
  const googleError = error ? GOOGLE_ERRORS[error] : undefined;
  const googleEnabled = googleSignInEnabled();
  const hasPassword = Boolean(adminPassword());

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
            O
          </span>
          <div>
            <div className="font-bold text-ink-900">OpenTenant</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500">Free · Open Source</div>
          </div>
        </div>

        <h1 className="text-lg font-semibold">Sign in</h1>

        {googleError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{googleError}</p>
        )}

        {googleEnabled && (
          <a
            href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.28-1.7V4.96H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.04l3.05-2.34z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.96l3.05 2.34C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            Sign in with Google
          </a>
        )}

        {googleEnabled && hasPassword && (
          <div className="my-4 flex items-center gap-3 text-xs text-ink-500">
            <div className="h-px flex-1 bg-slate-200" />
            or
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {hasPassword && (
          <>
            {!googleEnabled && (
              <p className="mt-1 text-sm text-ink-500">
                Enter the password you set in <code className="text-xs">ADMIN_PASSWORD</code>.
              </p>
            )}
            <form action={signIn} className="mt-3 space-y-3">
              <input type="hidden" name="next" value={nextPath} />
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoFocus={!googleEnabled}
                  autoComplete="current-password"
                  className="input"
                />
              </div>
              {passwordError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  That password didn&apos;t match. Try again.
                </p>
              )}
              <button className="btn w-full justify-center">Sign in</button>
            </form>
          </>
        )}

        {!googleEnabled && !hasPassword && (
          <p className="mt-3 text-sm text-ink-500">
            No sign-in method is configured, so this app isn&apos;t actually gated. Set{" "}
            <code className="text-xs">ADMIN_PASSWORD</code>, or{" "}
            <code className="text-xs">GOOGLE_CLIENT_ID</code> /{" "}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code> /{" "}
            <code className="text-xs">GOOGLE_ALLOWED_EMAILS</code>, to require sign-in.
          </p>
        )}

        <p className="mt-4 text-xs text-ink-500">
          Tenants and applicants don&apos;t need this — their portal and your listings pages stay public.
        </p>
      </div>
    </div>
  );
}
