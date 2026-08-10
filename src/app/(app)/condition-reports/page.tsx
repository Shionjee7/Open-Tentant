import Link from "next/link";
import { listConditionReports, listLeases, listProperties } from "@/lib/data";
import { createConditionReport } from "@/lib/actions";
import { shortDate, titleCase } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Condition reports" };

export default async function ConditionReportsPage() {
  const reports = await listConditionReports();
  const properties = await listProperties();
  const leases = await listLeases();

  return (
    <>
      <PageHeader
        title="Condition reports"
        subtitle="Document move-in and move-out condition room by room — your evidence for deposit deductions."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-ink-500">
              No condition reports yet. Create one at every move-in and move-out.
            </div>
          ) : (
            reports.map((r) => (
              <Link
                key={r.id}
                href={`/condition-reports/${r.id}`}
                className="card flex items-center justify-between px-5 py-4 transition hover:shadow-md"
              >
                <div>
                  <div className="font-semibold">
                    {r.property_name} — {titleCase(r.type)}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-500">
                    Created {shortDate(r.created)}
                    {r.completed_at ? ` · completed ${shortDate(r.completed_at)}` : ""}
                  </div>
                </div>
                <Badge value={r.status} />
              </Link>
            ))
          )}
        </div>

        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New condition report</h2>
          <form action={createConditionReport} className="space-y-3">
            <div>
              <label className="label">Property</label>
              <select name="property_id" required className="input">
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lease (optional)</label>
              <select name="lease_id" className="input" defaultValue="">
                <option value="">—</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.property_name} ({shortDate(l.start_date)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" defaultValue="move_in" className="input">
                <option value="move_in">Move-in</option>
                <option value="move_out">Move-out</option>
              </select>
            </div>
            <button className="btn w-full">Create report</button>
            <p className="text-xs text-ink-500">
              Starts with a standard 12-area checklist you fill in room by room.
            </p>
          </form>
        </section>
      </div>
    </>
  );
}
