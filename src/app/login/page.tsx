import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, adminPassword, sessionToken } from "@/lib/auth";

export const metadata = { title: "Sign in" };

async function signIn(formData: FormData) {
  "use server";
  const password = adminPassword();
  const submitted = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!password || submitted !== password) {
    redirect(`/login?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next.startsWith("/") ? next : "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

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
        <p className="mt-1 text-sm text-ink-500">
          Enter the password you set in <code className="text-xs">ADMIN_PASSWORD</code>.
        </p>

        <form action={signIn} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="input"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              That password didn&apos;t match. Try again.
            </p>
          )}
          <button className="btn w-full justify-center">Sign in</button>
        </form>

        <p className="mt-4 text-xs text-ink-500">
          Tenants and applicants don&apos;t need this — their portal and your listings pages stay public.
        </p>
      </div>
    </div>
  );
}
