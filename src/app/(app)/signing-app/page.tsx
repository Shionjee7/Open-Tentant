import Link from "next/link";
import { openSignAppUrl, openSignBundled, openSignReachable } from "@/lib/opensign";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Signing app" };
export const dynamic = "force-dynamic";

/**
 * OpenSign, inside OpenTenant.
 *
 * Started by `docker compose --profile esign up -d`, it runs as a sibling
 * container and shows up here in a frame — so a landlord who wants OpenSign's
 * own editor (drag signature fields onto any PDF, send to people who aren't
 * tenants, keep a document library) never has to leave the app or remember a
 * second address.
 *
 * OpenTenant's own signing needs none of this; see any lease page.
 */
export default async function SigningAppPage() {
  const appUrl = await openSignAppUrl();
  const bundled = await openSignBundled();
  const up = await openSignReachable();

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <PageHeader
        title="Signing app"
        subtitle="OpenSign, running alongside OpenTenant — for signing anything that isn't a lease."
        action={
          up ? (
            <a href={appUrl} target="_blank" className="btn-secondary">
              Open in a new tab ↗
            </a>
          ) : undefined
        }
      />

      {up ? (
        <div className="card min-h-0 flex-1 overflow-hidden p-0">
          <iframe
            src={appUrl}
            title="OpenSign"
            className="h-full w-full border-0"
            allow="clipboard-write; fullscreen"
          />
        </div>
      ) : (
        <div className="card max-w-2xl p-6">
          <h2 className="font-semibold">Turn on the signing app</h2>
          <p className="mt-1.5 text-sm text-ink-700">
            {bundled
              ? "OpenSign is configured but not responding yet — it takes a minute to start the first time. Reload this page shortly."
              : "OpenSign is an open-source signing app. Start it next to OpenTenant with one command and it appears right here."}
          </p>

          <pre className="mt-4 overflow-x-auto rounded-lg bg-ink-900 px-4 py-3 text-xs text-slate-100">
            npm run esign
          </pre>

          <p className="mt-3 text-sm text-ink-700">
            That generates a key, starts OpenSign and its database as extra containers, and waits
            until it answers. Documents stay on this machine — no cloud account, no per-document
            fee. The first run downloads a few hundred megabytes, so give it a minute.
          </p>

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-700">
            <strong>You may not need it.</strong> Leases are signed inside OpenTenant already —
            open any lease and press <em>Send for signature</em>. OpenSign is for the extra cases:
            signing a document that isn&apos;t a lease, or sending one to somebody who isn&apos;t a
            tenant.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/leases" className="btn">
              Sign a lease instead
            </Link>
            <Link href="/settings" className="btn-secondary">
              Point at my own instance
            </Link>
          </div>

          <p className="mt-4 text-xs text-ink-500">
            Running OpenSign somewhere else already? Put its address in Settings → E-signatures and
            it shows up here instead.
          </p>
        </div>
      )}
    </div>
  );
}
