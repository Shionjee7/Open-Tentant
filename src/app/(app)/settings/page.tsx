import { listQuestions } from "@/lib/data";
import { getSetting } from "@/lib/data";
import { archiveQuestion, createQuestion, saveSettings, sendTestEmail } from "@/lib/actions";
import { PageHeader, ProBadge } from "@/components/ui";
import EmailSettings from "@/components/EmailSettings";
import { titleCase } from "@/lib/format";
import {
  adminPassword,
  authGateEnabled,
  googleAllowlistCount,
  googleCredentialsConfigured,
  googleSignInEnabled,
} from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string; reason?: string }>;
}) {
  const { mail, reason } = await searchParams;
  const questions = await listQuestions();
  return (
    <>
      <PageHeader title="Settings" subtitle="Your business details, payment setup, e-sign, and application questions." />

      <div className="grid gap-6 xl:grid-cols-2">
        <form action={saveSettings} className="card space-y-4 p-6">
          <h2 className="font-semibold">Business & payments</h2>
          <div>
            <label className="label">Business name (shown on public pages)</label>
            <input name="business_name" defaultValue={await getSetting("business_name")} className="input" placeholder="Sunrise Property Management" />
          </div>
          <div>
            <label className="label">Accepted payment methods</label>
            <input
              name="payment_methods"
              defaultValue={await getSetting("payment_methods")}
              className="input"
              placeholder="Zelle, Venmo, ACH, credit card, cash, check"
            />
            <p className="mt-1 text-xs text-ink-500">Whatever you accept — shown to tenants in their portal.</p>
          </div>
          <div>
            <label className="label">Payment instructions for tenants</label>
            <textarea
              name="payment_instructions"
              rows={4}
              defaultValue={await getSetting("payment_instructions")}
              className="input"
              placeholder={"Zelle: you@example.com (memo: your unit)\nStripe payment link: https://buy.stripe.com/…\nChecks payable to …"}
            />
          </div>
          <h2 className="pt-2 font-semibold">E-signature (OpenSign)</h2>
          <p className="-mt-2 text-xs text-ink-500">
            Leases are generated in-app and signed through{" "}
            <a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">
              OpenSign
            </a>. Self-hosting it is free — point this at your instance.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Default provider</label>
              <select name="esign_provider" defaultValue={await getSetting("esign_provider", "opensign")} className="input">
                <option value="opensign">OpenSign (open source)</option>
                <option value="documenso">Documenso (open source)</option>
                <option value="docuseal">DocuSeal (open source)</option>
                <option value="">None / paper</option>
              </select>
            </div>
            <div>
              <label className="label">Your OpenSign URL</label>
              <input
                name="esign_base_url"
                type="url"
                defaultValue={await getSetting("esign_base_url")}
                className="input"
                placeholder="https://sign.yourdomain.com"
              />
            </div>
          </div>

          <details className="rounded-lg bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Optional: connect the OpenSign API for automatic sending
            </summary>
            <p className="mt-2 text-xs text-ink-500">
              Everything works without this — you upload the generated lease to OpenSign and paste
              the signing link back. OpenSign&apos;s REST API is a <strong>paid</strong> feature
              (their cloud plans, or a paid self-hosted plan), so it stays off unless you add a
              token. With one, leases send and track themselves.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">API base URL</label>
                <input
                  name="opensign_api_url"
                  type="url"
                  defaultValue={await getSetting("opensign_api_url")}
                  className="input"
                  placeholder="https://app.opensignlabs.com/api/v1.2"
                />
              </div>
              <div>
                <label className="label">
                  API token {await getSetting("opensign_api_token") && <span className="text-emerald-600">· saved</span>}
                </label>
                <input
                  name="opensign_api_token"
                  type="password"
                  className="input"
                  placeholder={await getSetting("opensign_api_token") ? "•••••• (leave blank to keep)" : "x-api-token value"}
                  autoComplete="off"
                />
              </div>
              {await getSetting("opensign_api_token") && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="clear_token" className="h-4 w-4 rounded border-slate-300" />
                  Remove the saved token
                </label>
              )}
            </div>
          </details>

          <button className="btn">Save settings</button>
        </form>

        <section id="email" className="card p-6">
          <h2 className="font-semibold">Email notifications</h2>
          <p className="mt-1 text-xs text-ink-500">
            Connect your Gmail (or any email account) and OpenTenant will confirm applications,
            announce new ones to you, send approval and denial notices, rent reminders and
            receipts, and maintenance updates.
          </p>

          {mail && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                mail === "sent"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {mail === "sent" && "Test email sent — check the inbox."}
              {mail === "noaddress" && "Add a notification address first."}
              {mail === "failed" && (
                <>
                  Couldn&apos;t send: {reason ?? "check the server, address, and password."}
                  <br />
                  <span className="text-xs">
                    With Gmail, make sure you used an App Password, not your account password.
                  </span>
                </>
              )}
            </div>
          )}

          <form action={saveSettings} className="mt-4 space-y-4">

            <div>
              <label className="label">Public address of this app</label>
              <input
                name="app_url"
                type="url"
                defaultValue={await getSetting("app_url")}
                className="input"
                placeholder="https://rentals.yourdomain.com"
              />
              <p className="mt-1 text-xs text-ink-500">
                Used to build the links inside emails, like tenant portal links.
              </p>
            </div>

            <EmailSettings
              host={await getSetting("smtp_host")}
              port={await getSetting("smtp_port")}
              secure={await getSetting("smtp_secure")}
              user={await getSetting("smtp_user")}
              fromName={await getSetting("smtp_from_name")}
              fromEmail={await getSetting("smtp_from_email")}
              notifyEmail={await getSetting("smtp_notify_email")}
              hasPassword={Boolean(await getSetting("smtp_password"))}
            />

            <button className="btn">Save email settings</button>
          </form>

          <form action={sendTestEmail} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <div className="flex-1">
              <label className="label">Send a test email to</label>
              <input
                name="to"
                type="email"
                defaultValue={await getSetting("smtp_notify_email")}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <button className="btn-secondary">Send test</button>
          </form>
        </section>

        <section id="security" className="card p-6">
          <h2 className="font-semibold">Sign-in &amp; security</h2>
          <p className="mt-1 text-xs text-ink-500">
            Google sign-in and the shared password are configured through environment variables,
            not this form — that keeps the login gate checkable without a database round trip, so a
            database outage can never accidentally unlock the app.
          </p>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt>Login gate</dt>
              <dd className={authGateEnabled() ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                {authGateEnabled() ? "On" : "Off — anyone with the URL has full access"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt>Shared password</dt>
              <dd className={adminPassword() ? "font-medium text-emerald-600" : "text-ink-500"}>
                {adminPassword() ? "Set" : "Not set"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <dt>Google sign-in</dt>
              <dd className={googleSignInEnabled() ? "font-medium text-emerald-600" : "text-ink-500"}>
                {googleSignInEnabled()
                  ? `On · ${googleAllowlistCount()} account${googleAllowlistCount() === 1 ? "" : "s"} allowed`
                  : googleCredentialsConfigured()
                    ? "Credentials set, but no allowed accounts yet"
                    : "Not configured"}
              </dd>
            </div>
          </dl>

          <details className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-ink-500">
            <summary className="cursor-pointer font-medium text-ink-700">
              How to turn on Google sign-in
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                In the{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline"
                >
                  Google Cloud Console
                </a>
                , create an OAuth client (type: Web application).
              </li>
              <li>
                Add this authorized redirect URI:{" "}
                <code className="rounded bg-white px-1 py-0.5">
                  {(await getSetting("app_url")) || "https://your-domain.com"}/api/auth/google/callback
                </code>
              </li>
              <li>
                Set these environment variables and restart the app:
                <pre className="mt-1 overflow-x-auto rounded bg-white p-2">
{`GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_ALLOWED_EMAILS=you@gmail.com,partner@gmail.com`}
                </pre>
              </li>
            </ol>
            <p className="mt-2">
              Only the emails listed in <code>GOOGLE_ALLOWED_EMAILS</code> can sign in — being a
              real Google account isn&apos;t enough on its own.
            </p>
          </details>
        </section>

        <section id="questions" className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            Custom application questions <ProBadge />
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            Asked on every public rental application, answers show on the application detail page.
          </p>
          <ul className="mt-4 space-y-2">
            {questions.length === 0 && (
              <li className="text-sm text-ink-500">No questions yet — add your first below.</li>
            )}
            {questions.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{q.question}</span>
                  <span className="ml-2 text-xs text-ink-500">
                    {titleCase(q.type === "yesno" ? "yes_no" : q.type)}{q.required ? " · required" : ""}
                  </span>
                </div>
                <form action={archiveQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <button className="btn-secondary btn-sm" title="Remove from future applications">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={createQuestion} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label className="label">New question</label>
              <input name="question" required className="input" placeholder="Do you have pets?" />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label">Answer type</label>
                <select name="type" defaultValue="text" className="input">
                  <option value="text">Free text</option>
                  <option value="yesno">Yes / No</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="required" className="h-4 w-4 rounded border-slate-300" />
                Required
              </label>
              <button className="btn">Add</button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
