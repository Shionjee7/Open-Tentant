import { listQuestions } from "@/lib/data";
import { getSetting } from "@/lib/db";
import { archiveQuestion, createQuestion, saveSettings } from "@/lib/actions";
import { PageHeader, ProBadge } from "@/components/ui";
import { titleCase } from "@/lib/format";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const questions = listQuestions();
  return (
    <>
      <PageHeader title="Settings" subtitle="Your business details, payment setup, e-sign, and application questions." />

      <div className="grid gap-6 xl:grid-cols-2">
        <form action={saveSettings} className="card space-y-4 p-6">
          <h2 className="font-semibold">Business & payments</h2>
          <div>
            <label className="label">Business name (shown on public pages)</label>
            <input name="business_name" defaultValue={getSetting("business_name")} className="input" placeholder="Sunrise Property Management" />
          </div>
          <div>
            <label className="label">Accepted payment methods</label>
            <input
              name="payment_methods"
              defaultValue={getSetting("payment_methods")}
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
              defaultValue={getSetting("payment_instructions")}
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
              <select name="esign_provider" defaultValue={getSetting("esign_provider", "opensign")} className="input">
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
                defaultValue={getSetting("esign_base_url")}
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
                  defaultValue={getSetting("opensign_api_url")}
                  className="input"
                  placeholder="https://app.opensignlabs.com/api/v1.2"
                />
              </div>
              <div>
                <label className="label">
                  API token {getSetting("opensign_api_token") && <span className="text-emerald-600">· saved</span>}
                </label>
                <input
                  name="opensign_api_token"
                  type="password"
                  className="input"
                  placeholder={getSetting("opensign_api_token") ? "•••••• (leave blank to keep)" : "x-api-token value"}
                  autoComplete="off"
                />
              </div>
              {getSetting("opensign_api_token") && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="clear_token" className="h-4 w-4 rounded border-slate-300" />
                  Remove the saved token
                </label>
              )}
            </div>
          </details>

          <button className="btn">Save settings</button>
        </form>

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
