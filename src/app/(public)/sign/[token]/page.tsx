import Link from "next/link";
import { getSetting, getSignatureByToken } from "@/lib/data";
import { premisesLabel, renderLease } from "@/lib/lease-render";
import { CONSENT_TEXT, shortHash, signingProgress } from "@/lib/signing";
import { declineDocument, signDocument } from "@/lib/actions";
import { money, shortDate } from "@/lib/format";
import SignaturePad from "@/components/SignaturePad";

export const metadata = { title: "Sign your lease", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Missing({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <div className="text-3xl">🔒</div>
      <h1 className="mt-2 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-700">{body}</p>
    </div>
  );
}

export default async function SignPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { token } = await params;
  const { notice } = await searchParams;
  const signature = await getSignatureByToken(token);

  if (!signature) {
    return (
      <Missing
        title="This link isn't valid"
        body="It may have been cancelled or mistyped. Ask whoever sent it for a fresh link."
      />
    );
  }

  const rendered = await renderLease(signature.lease);
  if (!rendered) {
    return <Missing title="Lease not found" body="The lease behind this link no longer exists." />;
  }

  const business = (await getSetting("business_name")) || "Your landlord";
  const progress = signingProgress(rendered.signatures);
  const premises = premisesLabel(rendered);
  const others = rendered.signatures.filter((s) => s.id !== signature.id && s.status !== "cancelled");

  if (signature.status === "cancelled") {
    return (
      <Missing
        title="This request was withdrawn"
        body={`${business} cancelled this signing request. If that's a surprise, get in touch with them.`}
      />
    );
  }

  const documentUrl = `/sign/${token}/document`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">
          {signature.status === "signed" ? "Your signed lease" : "Your lease is ready to sign"}
        </h1>
        <p className="mt-1 text-sm text-ink-700">
          {premises} · {money(rendered.lease.rent)}/month
          {rendered.lease.start_date ? ` · starts ${shortDate(rendered.lease.start_date)}` : ""}
        </p>
      </div>

      {notice === "declined" && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You&apos;ve declined this lease and {business} has been told. Nothing was signed.
        </div>
      )}

      {signature.status === "signed" && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>Signed on {shortDate(signature.signed_at.slice(0, 10))}.</strong>{" "}
          {progress.complete
            ? "Everyone has signed — the copy below is the final lease, with its certificate of completion."
            : `Waiting on ${progress.pending} other ${progress.pending === 1 ? "signer" : "signers"}. You'll get the final copy by email once everyone's done.`}{" "}
          Keep this link — the signed lease stays here.
        </div>
      )}

      {signature.status === "declined" && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You declined this lease{signature.decline_reason ? ` — “${signature.decline_reason}”` : ""}. Nothing
          was signed.
        </div>
      )}

      {/* Step 1 — read it */}
      <section className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">
            {signature.status === "signed" ? "The lease" : "1. Read the lease"}
          </h2>
          <Link href={documentUrl} target="_blank" className="btn-secondary btn-sm">
            Open full screen ↗
          </Link>
        </div>
        <iframe
          src={documentUrl}
          title="Lease document"
          className="h-[26rem] w-full border-0 bg-white sm:h-[34rem]"
        />
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-ink-500">
          Scroll inside the box to read all of it, or open it full screen to print or save a copy.
        </p>
      </section>

      {signature.status === "pending" && (
        <section className="card mb-5">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">2. Sign it</h2>
          </div>
          <form action={signDocument} className="space-y-4 px-5 py-4">
            <input type="hidden" name="token" value={token} />

            <SignaturePad defaultName={signature.signer_name} />

            <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <input type="checkbox" name="consent" value="yes" required className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{CONSENT_TEXT}</span>
            </label>

            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="agree" value="yes" required className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                I have read the lease above and I agree to its terms. I understand pressing{" "}
                <strong>Sign the lease</strong> below is my signature.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button className="btn">Sign the lease</button>
              <span className="text-xs text-ink-500">
                Signing as {signature.signer_email} · {new Date().toLocaleDateString()}
              </span>
            </div>
          </form>

          <details className="border-t border-slate-100 px-5 py-3">
            <summary className="cursor-pointer text-sm text-ink-500 hover:text-ink-900">
              I don&apos;t want to sign this
            </summary>
            <form action={declineDocument} className="mt-3 space-y-2">
              <input type="hidden" name="token" value={token} />
              <label className="label">Tell {business} why (optional)</label>
              <input name="reason" className="input" placeholder="e.g. the start date doesn't work" />
              <button className="btn-secondary btn-sm">Decline to sign</button>
            </form>
          </details>
        </section>
      )}

      {/* Who else is signing */}
      {others.length > 0 && (
        <section className="card mb-5 p-5">
          <h2 className="mb-2 font-semibold">Everyone signing</h2>
          <ul className="space-y-1.5 text-sm">
            {[signature, ...others].map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span>
                  {s.signer_name}
                  {s.id === signature.id && <span className="text-ink-500"> (you)</span>}
                  <span className="text-ink-500"> · {s.role === "landlord" ? "Landlord" : "Tenant"}</span>
                </span>
                <span
                  className={
                    s.status === "signed"
                      ? "text-emerald-600"
                      : s.status === "declined"
                        ? "text-rose-600"
                        : "text-ink-500"
                  }
                >
                  {s.status === "signed"
                    ? `Signed ${shortDate(s.signed_at.slice(0, 10))}`
                    : s.status === "declined"
                      ? "Declined"
                      : "Waiting"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ink-500">
        This link is private — anyone with it can see your lease, so don&apos;t share it. Document
        fingerprint <code className="font-mono">{shortHash(rendered.hash)}</code>. Sent by {business}.
      </p>
    </div>
  );
}
