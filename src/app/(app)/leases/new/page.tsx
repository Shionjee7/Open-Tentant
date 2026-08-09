import { listAllUnits, listPeople, listProperties } from "@/lib/data";
import { getSetting } from "@/lib/db";
import { createLease } from "@/lib/actions";
import { BackLink, PageHeader } from "@/components/ui";
import LeasePropertyPicker from "@/components/LeasePropertyPicker";

export const metadata = { title: "New lease" };

export default function NewLeasePage() {
  const properties = listProperties();
  const units = listAllUnits();
  const people = listPeople().filter((p) => p.stage === "tenant" || p.stage === "applicant");
  const defaultProvider = getSetting("esign_provider", "documenso");

  return (
    <>
      <BackLink href="/leases" label="Leases" />
      <PageHeader
        title="New lease"
        subtitle="Attach a property and one or more tenants, then send it for e-signature."
      />
      <form action={createLease} className="card max-w-3xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <LeasePropertyPicker properties={properties} units={units} />
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue="draft" className="input">
              <option value="draft">Draft</option>
              <option value="sent">Sent for signature</option>
              <option value="signed">Signed</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="end_date" type="date" required className="input" />
          </div>
        </div>

        <div>
          <label className="label">Tenants ({people.length === 0 ? "add tenants or applicants first" : "select all that apply"})</label>
          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            {people.length === 0 ? (
              <p className="text-sm text-ink-500">No tenants or applicants yet — add them under Leads &amp; Tenants.</p>
            ) : (
              people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="tenant_ids" value={p.id} className="h-4 w-4 rounded border-slate-300" />
                  {p.first_name} {p.last_name}
                  <span className="text-xs text-ink-500">({p.stage})</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <label className="label">E-sign provider</label>
            <select name="esign_provider" defaultValue={defaultProvider} className="input">
              <option value="">None / paper</option>
              <option value="documenso">Documenso (open source)</option>
              <option value="docuseal">DocuSeal (open source)</option>
              <option value="opensign">OpenSign (open source)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Signing link (from your e-sign tool)</label>
            <input name="esign_url" type="url" className="input" placeholder="https://sign.example.com/…" />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" placeholder="Pet addendum, parking spot, utilities…" />
        </div>

        <button className="btn">Create lease</button>
      </form>
    </>
  );
}
