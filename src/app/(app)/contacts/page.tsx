import Link from "next/link";
import { countPeopleByStage, listPeople, listProperties } from "@/lib/data";
import { createPerson, moveOutTenant, sendPortalInvite, setPersonStage } from "@/lib/actions";
import { shortDate } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Leads & Tenants" };

const STAGES: { key: string; label: string }[] = [
  { key: "lead", label: "Leads" },
  { key: "applicant", label: "Applicants" },
  { key: "tenant", label: "Tenants" },
  { key: "past", label: "Past tenants" },
];

const NEXT_STAGE: Record<string, { stage: string; label: string }> = {
  lead: { stage: "applicant", label: "Convert to applicant" },
  applicant: { stage: "tenant", label: "Convert to tenant" },
  tenant: { stage: "past", label: "Move out" },
  past: { stage: "tenant", label: "Restore to tenant" },
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; moved?: string; mail?: string }>;
}) {
  const { stage: rawStage, moved, mail } = await searchParams;
  const stage = STAGES.some((s) => s.key === rawStage) ? rawStage! : "lead";
  const people = await listPeople(stage);
  const counts = await countPeopleByStage();
  const properties = await listProperties();

  return (
    <>
      <PageHeader
        title="Leads & Tenants"
        subtitle="Track everyone from first inquiry to move-out — leads, applicants, active tenants, and past tenants."
      />

      {(moved || mail) && (
        <div className="card mb-5 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {moved === "1" && "Moved out — their lease is ended, the room is free, and they're filed under past tenants."}
          {mail === "sent" && "Portal link emailed."}
          {mail === "failed" && "Couldn't send the email — check your email settings."}
          {mail === "noaddress" && "That tenant has no email address."}
        </div>
      )}

      <div className="mb-5 flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium">
        {STAGES.map((s) => (
          <Link
            key={s.key}
            href={`/contacts?stage=${s.key}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center transition ${
              stage === s.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {s.label} <span className="text-ink-500">({counts[s.key] ?? 0})</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          {people.length === 0 ? (
            <EmptyState
              title={`No ${STAGES.find((s) => s.key === stage)?.label.toLowerCase()}`}
              message={
                stage === "lead"
                  ? "Leads come in from your public listings page, or add one manually."
                  : "Use the form to add someone, or move contacts through the pipeline."
              }
            />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Contact</th>
                    <th className="th">Property</th>
                    <th className="th">Added</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const next = NEXT_STAGE[p.stage];
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="td">
                          <div className="font-medium text-ink-900">{p.first_name} {p.last_name}</div>
                          {p.notes && <div className="mt-0.5 max-w-56 truncate text-xs text-ink-500">{p.notes}</div>}
                        </td>
                        <td className="td">
                          <div>{p.email || "—"}</div>
                          <div className="text-xs text-ink-500">{p.phone}</div>
                        </td>
                        <td className="td">
                          {p.property_name ?? "—"}
                          {p.unit_name && <div className="text-xs text-ink-500">{p.unit_name}</div>}
                        </td>
                        <td className="td">{shortDate(p.created)}</td>
                        <td className="td text-right">
                          <div className="flex items-center justify-end gap-2">
                            {p.stage === "tenant" && p.portal_token && (
                              <>
                                <Link
                                  href={`/portal/${p.portal_token}`}
                                  target="_blank"
                                  className="text-xs font-medium text-brand-600 hover:underline"
                                  title="Tenant portal — share this link with the tenant"
                                >
                                  Portal ↗
                                </Link>
                                {p.email && (
                                  <form action={sendPortalInvite} className="inline">
                                    <input type="hidden" name="id" value={p.id} />
                                    <button className="btn-secondary btn-sm" title="Email this tenant their portal link">
                                      Email link
                                    </button>
                                  </form>
                                )}
                              </>
                            )}
                            {p.stage === "tenant" ? (
                              <form action={moveOutTenant} className="inline">
                                <input type="hidden" name="id" value={p.id} />
                                <button
                                  className="btn-secondary btn-sm"
                                  title="Ends their lease, frees the room, and files them under past tenants"
                                >
                                  Move out
                                </button>
                              </form>
                            ) : (
                              next && (
                                <form action={setPersonStage} className="inline">
                                  <input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="stage" value={next.stage} />
                                  <button className="btn-secondary btn-sm">{next.label}</button>
                                </form>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Add contact</h2>
          <form action={createPerson} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input name="first_name" required className="input" />
              </div>
              <div>
                <label className="label">Last name</label>
                <input name="last_name" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="input" />
            </div>
            <div>
              <label className="label">Stage</label>
              <select name="stage" defaultValue={stage} className="input">
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Interested property</label>
              <select name="property_id" className="input" defaultValue="">
                <option value="">None</option>
                {properties.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="input" />
            </div>
            <button className="btn w-full">Add contact</button>
          </form>
        </section>
      </div>
    </>
  );
}
