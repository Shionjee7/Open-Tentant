import { listPeople, listProperties } from "@/lib/data";
import { createMaintenance } from "@/lib/actions";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "New maintenance request" };

export default function NewMaintenancePage() {
  const properties = listProperties();
  const tenants = listPeople("tenant");
  return (
    <>
      <BackLink href="/maintenance" label="Maintenance" />
      <PageHeader title="New maintenance request" />
      <form action={createMaintenance} className="card max-w-2xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Property</label>
            <select name="property_id" required className="input">
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reported by (optional)</label>
            <select name="person_id" className="input" defaultValue="">
              <option value="">—</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input name="title" required className="input" placeholder="Kitchen faucet dripping" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea name="description" rows={3} className="input" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" defaultValue="medium" className="input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <button className="btn">Create request</button>
      </form>
    </>
  );
}
