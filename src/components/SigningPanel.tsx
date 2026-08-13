import Link from "next/link";
import {
  cancelSigning,
  markLeaseSigned,
  refreshSigningStatus,
  remindSigner,
  saveSigningLink,
  sendForSigning,
  sendLeaseForSignature,
} from "@/lib/actions";
import { hasApiAccess, openSignAppUrl, openSignBundled } from "@/lib/opensign";
import { renderLease } from "@/lib/lease-render";
import { shortHash, signingProgress, tamperCheck } from "@/lib/signing";
import { shortDate } from "@/lib/format";
import { Badge } from "@/components/ui";
import type { Lease, Person, Signature } from "@/lib/types";

const NOTICES: Record<string, { tone: "good" | "warn"; text: string }> = {
  requested: { tone: "good", text: "Signing links sent. Each tenant got their own private link by email." },
  reminded: { tone: "good", text: "Reminder sent." },
  cancelled: { tone: "warn", text: "Outstanding signing links were withdrawn and no longer work." },
  sent: { tone: "good", text: "Sent through OpenSign — signers have been emailed." },
  guided: { tone: "good", text: "Marked as sent. Upload the lease to OpenSign and send it, then paste the signing link below." },
  signed: { tone: "good", text: "Everyone has signed. The lease is ready to activate." },
  declined: { tone: "warn", text: "A signer declined." },
  failed: { tone: "warn", text: "OpenSign rejected the request — details were added to the lease notes." },
  nosigners: { tone: "warn", text: "Add an email address to at least one tenant before sending." },
  nodoc: { tone: "warn", text: "Couldn't generate the lease document to send." },
  nostatus: { tone: "warn", text: "No status available yet — that needs an OpenSign API token." },
};

function StatusRow({
  signature,
  leaseId,
}: {
  signature: Signature;
  leaseId: string;
}) {
  const label =
    signature.status === "signed"
      ? `Signed ${shortDate(signature.signed_at.slice(0, 10))}`
      : signature.status === "declined"
        ? "Declined"
        : signature.status === "cancelled"
          ? "Withdrawn"
          : "Waiting";
  const tone =
    signature.status === "signed"
      ? "text-emerald-600"
      : signature.status === "declined"
        ? "text-rose-600"
        : "text-ink-500";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {signature.signer_name}
          <span className="ml-1.5 text-xs font-normal text-ink-500">
            {signature.role === "landlord" ? "you" : "tenant"}
          </span>
        </div>
        <div className="truncate text-xs text-ink-500">{signature.signer_email || "no email"}</div>
        {signature.status === "declined" && signature.decline_reason && (
          <div className="text-xs text-rose-600">“{signature.decline_reason}”</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs ${tone}`}>{label}</span>
        {signature.status === "pending" && signature.role === "landlord" && (
          <Link href={`/sign/${signature.token}`} className="btn btn-sm">
            Sign now
          </Link>
        )}
        {signature.status === "pending" && signature.role === "tenant" && (
          <>
            <Link href={`/sign/${signature.token}`} target="_blank" className="btn-secondary btn-sm">
              Open link ↗
            </Link>
            <form action={remindSigner}>
              <input type="hidden" name="lease_id" value={leaseId} />
              <input type="hidden" name="signature_id" value={signature.id} />
              <button className="btn-secondary btn-sm">Remind</button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Lease signing.
 *
 * Signing is built in: tenants get a private link, read the lease, consent,
 * and sign — no account and no second service. OpenSign stays available for
 * anyone who already runs it (bundled alongside this app or hosted elsewhere),
 * tucked away so it isn't a decision a first-time landlord has to make.
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
  const rendered = await renderLease(lease.id);
  const signatures = rendered?.signatures.filter((x) => x.status !== "cancelled") ?? [];
  const progress = signingProgress(signatures);
  const tamper = tamperCheck(signatures, rendered?.hash ?? "");

  const automatic = await hasApiAccess();
  const appUrl = await openSignAppUrl();
  const bundled = await openSignBundled();
  const missingEmails = tenants.filter((t) => !t.email);
  const message = notice ? NOTICES[notice] : undefined;
  const started = signatures.length > 0;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Lease document &amp; signing</h2>
          <p className="text-xs text-ink-500">
            Signed right here — free, unlimited, with a full audit trail on every signature.
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

      {!tamper.ok && (
        <div className="bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <strong>This lease was edited after it was signed.</strong> The signatures belong to the
          earlier version, so they no longer match what&apos;s on screen. Send it for signature again
          so everyone signs the terms as they now stand.
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href={`/leases/${lease.id}/document`} target="_blank" className="btn">
              Open lease document ↗
            </Link>
            {rendered && (
              <span className="text-xs text-ink-500">
                Fingerprint <code className="font-mono">{shortHash(rendered.hash)}</code>
              </span>
            )}
          </div>
        </div>

        {/* Step 2 — send it */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Step 2 — send for signature
          </div>

          {missingEmails.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {missingEmails.map((t) => `${t.first_name} ${t.last_name}`).join(", ")} has no email
              address — add one under Tenants so they can be sent a signing link.
            </p>
          )}

          <p className="mt-1 text-sm text-ink-700">
            Emails each tenant a private link. They read the lease, agree to sign electronically, and
            sign by typing or drawing their name. You sign from this page.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <form action={sendForSigning}>
              <input type="hidden" name="lease_id" value={lease.id} />
              <button className="btn">{started ? "Send again" : "Send for signature"}</button>
            </form>
            {started && progress.pending > 0 && (
              <form action={cancelSigning}>
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn-secondary">Withdraw links</button>
              </form>
            )}
          </div>
        </div>

        {/* Step 3 — who's signed */}
        {started && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Step 3 — signatures
              </div>
              <span className="text-xs text-ink-500">
                {progress.signed} of {progress.total} signed
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.total ? (progress.signed / progress.total) * 100 : 0}%` }}
              />
            </div>

            <ul className="mt-2">
              {signatures.map((signature) => (
                <StatusRow key={signature.id} signature={signature} leaseId={lease.id} />
              ))}
            </ul>

            {progress.complete && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                Fully signed. The lease document now carries every signature and a certificate of
                completion, and each signer has been emailed their copy.
              </p>
            )}
          </div>
        )}

        {/* Activate */}
        {lease.status !== "active" && (
          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Step 4 — activate
            </div>
            <p className="mt-1 text-sm text-ink-700">
              Activating starts the tenancy: the property or room shows as occupied and rent can be
              scheduled.
            </p>
            {lease.status !== "signed" && (
              <form action={markLeaseSigned} className="mt-2">
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn-secondary btn-sm">
                  Signed on paper — mark signed
                </button>
              </form>
            )}
          </div>
        )}

        {/* OpenSign, for anyone who wants it */}
        <details className="border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm text-ink-500 hover:text-ink-900">
            Use OpenSign instead
            {bundled && <span className="ml-1 text-emerald-600">· running alongside this app</span>}
          </summary>

          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-700">
              <a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">
                OpenSign
              </a>{" "}
              is a separate open-source signing app.{" "}
              {bundled
                ? "It's running next to OpenTenant on this server."
                : "Start it alongside OpenTenant with `docker compose --profile esign up -d`, or point at your own instance in Settings."}{" "}
              {automatic
                ? "An API token is configured, so sending is automatic."
                : "Its REST API is a paid feature, so the free path is to upload the lease there yourself and paste the signing link back."}
            </p>

            {automatic ? (
              <form action={sendLeaseForSignature}>
                <input type="hidden" name="lease_id" value={lease.id} />
                <input type="hidden" name="origin" value={process.env.APP_URL ?? "http://localhost:3000"} />
                <button className="btn-secondary btn-sm">Send via OpenSign</button>
              </form>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
                <li>Save the lease above as a PDF.</li>
                <li>
                  Open{" "}
                  <a href={appUrl} target="_blank" className="text-brand-600 hover:underline">
                    OpenSign ↗
                  </a>{" "}
                  and upload it, adding the tenant(s) as signers.
                </li>
                <li>Paste the signing link it gives you below.</li>
              </ol>
            )}

            <form action={saveSigningLink} className="flex flex-wrap items-end gap-2">
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
              <button className="btn-secondary btn-sm">Save link</button>
              {lease.esign_url && (
                <a href={lease.esign_url} target="_blank" className="btn-secondary btn-sm">
                  Open ↗
                </a>
              )}
            </form>

            {automatic && lease.esign_document_id && (
              <form action={refreshSigningStatus}>
                <input type="hidden" name="lease_id" value={lease.id} />
                <button className="btn-secondary btn-sm">Check status in OpenSign</button>
              </form>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
