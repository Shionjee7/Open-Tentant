import Link from "next/link";
import {
  markLeaseSigned,
  refreshSigningStatus,
  saveSigningLink,
  sendLeaseForSignature,
} from "@/lib/actions";
import { hasApiAccess, openSignAppUrl } from "@/lib/opensign";
import { Badge } from "@/components/ui";
import type { Lease, Person } from "@/lib/types";

const NOTICES: Record<string, { tone: "good" | "warn"; text: string }> = {
  sent: { tone: "good", text: "Sent through OpenSign — signers have been emailed." },
  guided: { tone: "good", text: "Marked as sent. Upload the lease to OpenSign and send it, then paste the signing link below." },
  signed: { tone: "good", text: "Everyone has signed. The lease is ready to activate." },
  declined: { tone: "warn", text: "A signer declined in OpenSign." },
  failed: { tone: "warn", text: "OpenSign rejected the request — details were added to the lease notes." },
  nosigners: { tone: "warn", text: "Add an email address to at least one tenant before sending." },
  nodoc: { tone: "warn", text: "Couldn't generate the lease document to send." },
  nostatus: { tone: "warn", text: "No status available yet — that needs an OpenSign API token." },
};

/**
 * Lease signing, built around OpenSign.
 *
 * The free self-hosted OpenSign app has no REST API, so the default flow hands
 * you the generated lease and a link into your instance. With an API token the
 * same button does it all without leaving the app.
 */
export default async function SigningPanel({
  lease,
  tenants,
  notice,
}: {
  lease: Lease;
  tenants: Person[];
  notice?: string;
}) {
  const automatic = await hasApiAccess();
  const appUrl = await openSignAppUrl();
  const missingEmails = tenants.filter((t) => !t.email);
  const message = notice ? NOTICES[notice] : undefined;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Lease document &amp; signing</h2>
          <p className="text-xs text-ink-500">
            Powered by{" "}
            <a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">
              OpenSign
            </a>{" "}
            — open source e-signatures.{" "}
            {automatic ? "API connected: sending is automatic." : "Free mode: you send from your own OpenSign instance."}
          </p>
        </div>
        <Badge value={lease.status} />
      </div>

      {message && (
        <div
          className={`px-5 py-3 text-sm ${
            message.tone === "good" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-5 px-5 py-4">
        {/* Step 1 — the document */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Step 1 — the lease</div>
          <p className="mt-1 text-sm text-ink-700">
            A complete lease is generated from this record — parties, premises, term, rent, deposit,
            and standard clauses, with signature blocks at the end.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/leases/${lease.id}/document`} target="_blank" className="btn">
              Open lease document ↗
            </Link>
            <span className="self-center text-xs text-ink-500">
              Use your browser&apos;s “Save as PDF” to get a file to upload.
            </span>
          </div>
        </div>

        {/* Step 2 — send it */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Step 2 — send for signature</div>

          {missingEmails.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {missingEmails.map((t) => `${t.first_name} ${t.last_name}`).join(", ")} has no email
              address — add one under Leads &amp; Tenants so OpenSign can reach them.
            </p>
          )}

          {automatic ? (
            <>
              <p className="mt-1 text-sm text-ink-700">
                Sends the lease to {tenants.length || "the"} signer{tenants.length === 1 ? "" : "s"} through
                your OpenSign account and stores the signing link here.
              </p>
              <form action={sendLeaseForSignature} className="mt-2">
                <input type="hidden" name="lease_id" value={lease.id} />
                <input type="hidden" name="origin" value={process.env.APP_URL ?? "http://localhost:3000"} />
                <button className="btn">Send via OpenSign</button>
              </form>
            </>
          ) : (
            <>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-700">
                <li>Save the lease above as a PDF.</li>
                <li>
                  Open{" "}
                  <a href={appUrl} target="_blank" className="text-brand-600 hover:underline">
                    your OpenSign instance ↗
                  </a>{" "}
                  and upload it, adding the tenant(s) as signers.
                </li>
                <li>Copy the signing link OpenSign gives you and paste it below.</li>
              </ol>
              <form action={sendLeaseForSignature} className="mt-2">
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn-secondary">Mark as sent</button>
              </form>
            </>
          )}
        </div>

        {/* Step 3 — track it */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Step 3 — track signing</div>

          <form action={saveSigningLink} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="lease_id" value={lease.id} />
            <div className="min-w-64 flex-1">
              <label className="label">Signing link</label>
              <input
                name="esign_url"
                type="url"
                defaultValue={lease.esign_url}
                className="input"
                placeholder={`${appUrl}/load/recipientSignPdf/…`}
              />
            </div>
            <button className="btn-secondary">Save link</button>
            {lease.esign_url && (
              <a href={lease.esign_url} target="_blank" className="btn-secondary">
                Open ↗
              </a>
            )}
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {automatic && lease.esign_document_id && (
              <form action={refreshSigningStatus}>
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn-secondary btn-sm">Check status in OpenSign</button>
              </form>
            )}
            {lease.status !== "signed" && lease.status !== "active" && (
              <form action={markLeaseSigned}>
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn btn-sm">Everyone signed — mark signed</button>
              </form>
            )}
          </div>

          {!automatic && (
            <p className="mt-3 text-xs text-ink-500">
              Want this fully automatic? OpenSign&apos;s REST API is a paid feature, so it stays off by
              default. If you have a token (OpenSign cloud or a paid self-hosted plan), add it in
              Settings and this panel sends and tracks on its own.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
