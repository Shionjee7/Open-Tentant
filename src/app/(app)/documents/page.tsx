import { listDocuments, listLeases, listProperties } from "@/lib/data";
import { getSetting } from "@/lib/db";
import { createDocument, setDocumentStatus } from "@/lib/actions";
import { shortDate, titleCase } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Documents & E-Sign" };

const NEXT: Record<string, { status: string; label: string }[]> = {
  draft: [{ status: "sent", label: "Mark sent" }],
  sent: [{ status: "viewed", label: "Mark viewed" }, { status: "signed", label: "Mark signed" }],
  viewed: [{ status: "signed", label: "Mark signed" }],
  signed: [],
};

export default function DocumentsPage() {
  const docs = listDocuments();
  const leases = listLeases();
  const properties = listProperties();
  const esignBase = getSetting("esign_base_url");

  return (
    <>
      <PageHeader
        title="Documents & E-Sign"
        subtitle="Track leases, addenda, and notices through draft → sent → signed. Signing runs through free open-source e-sign tools."
      />

      <div className="card mb-6 border-brand-100 bg-brand-50/60 p-4 text-sm">
        <p className="font-semibold text-ink-900">E-signatures, without DocuSign fees</p>
        <p className="mt-1 text-ink-700">
          Self-host an open-source signing tool and paste each document&apos;s signing link here:{" "}
          <a href="https://documenso.com" target="_blank" className="text-brand-600 hover:underline">Documenso</a>,{" "}
          <a href="https://www.docuseal.com" target="_blank" className="text-brand-600 hover:underline">DocuSeal</a>, or{" "}
          <a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">OpenSign</a>.
          {esignBase && (
            <>
              {" "}Your configured instance:{" "}
              <a href={esignBase} target="_blank" className="text-brand-600 hover:underline">{esignBase} ↗</a>
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <th className="th">Document</th>
                <th className="th">Property</th>
                <th className="th">Provider</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td className="td py-8 text-center text-ink-500" colSpan={5}>
                    No documents yet — add your first lease or addendum with the form.
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="table-row">
                    <td className="td">
                      <div className="font-medium text-ink-900">{d.name}</div>
                      <div className="text-xs text-ink-500">
                        {titleCase(d.type)} · added {shortDate(d.created_at)}
                        {d.signed_at ? ` · signed ${shortDate(d.signed_at)}` : ""}
                      </div>
                    </td>
                    <td className="td">{d.property_name ?? "—"}</td>
                    <td className="td">
                      {titleCase(d.provider)}
                      {d.external_url && (
                        <a href={d.external_url} target="_blank" className="ml-1 text-brand-600 hover:underline">↗</a>
                      )}
                    </td>
                    <td className="td"><Badge value={d.status} /></td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        {(NEXT[d.status] ?? []).map((t) => (
                          <form key={t.status} action={setDocumentStatus}>
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="status" value={t.status} />
                            <button className="btn-secondary btn-sm">{t.label}</button>
                          </form>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Add document</h2>
          <form action={createDocument} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input" placeholder="Maple St Lease 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select name="type" defaultValue="lease" className="input">
                  <option value="lease">Lease</option>
                  <option value="addendum">Addendum</option>
                  <option value="notice">Notice</option>
                  <option value="application">Application</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select name="status" defaultValue="draft" className="input">
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="signed">Signed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Property</label>
              <select name="property_id" className="input" defaultValue="">
                <option value="">—</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lease</label>
              <select name="lease_id" className="input" defaultValue="">
                <option value="">—</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>{l.property_name} ({shortDate(l.start_date)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">E-sign provider</label>
              <select name="provider" defaultValue="documenso" className="input">
                <option value="documenso">Documenso</option>
                <option value="docuseal">DocuSeal</option>
                <option value="opensign">OpenSign</option>
                <option value="manual">Manual / paper</option>
              </select>
            </div>
            <div>
              <label className="label">Signing / document link</label>
              <input name="external_url" type="url" className="input" placeholder="https://…" />
            </div>
            <button className="btn w-full">Add document</button>
          </form>
        </section>
      </div>
    </>
  );
}
