import { listLeases, listPeople } from "@/lib/data";
import { getSetting } from "@/lib/data";
import { createPayment } from "@/lib/actions";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage() {
  const leases = await listLeases();
  const tenants = await listPeople("tenant");
  const instructions = await getSetting("payment_instructions");

  return (
    <>
      <BackLink href="/payments" label="Payments" />
      <PageHeader
        title="Record or schedule payments"
        subtitle="Create a one-off charge or generate a monthly series (e.g. 12 months of rent)."
      />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
        <form action={createPayment} className="card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Lease</label>
              <select name="lease_id" className="input" defaultValue="">
                <option value="">No lease (one-off)</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.property_name} — {l.tenant_names ?? "no tenants"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tenant</label>
              <select name="person_id" className="input" defaultValue="">
                <option value="">—</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select name="type" defaultValue="rent" className="input">
                <option value="rent">Rent</option>
                <option value="deposit">Security deposit</option>
                <option value="late_fee">Late fee</option>
                <option value="utility">Utility</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Amount ($)</label>
              <input name="amount" type="number" min="0" step="0.01" required className="input" />
            </div>
            <div>
              <label className="label">First due date</label>
              <input name="due_date" type="date" required className="input" />
            </div>
            <div>
              <label className="label">Repeat monthly for</label>
              <select name="repeat_months" defaultValue="1" className="input">
                <option value="1">Just once</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input name="notes" className="input" placeholder="Optional" />
          </div>
          <button className="btn">Create payment(s)</button>
        </form>

        <aside className="card h-fit p-5 text-sm">
          <h2 className="mb-2 font-semibold">Your payment instructions</h2>
          {instructions ? (
            <p className="whitespace-pre-line text-ink-700">{instructions}</p>
          ) : (
            <p className="text-ink-500">
              Set up how tenants pay you (Zelle, Venmo, ACH, a Stripe payment link — whatever you use) in Settings.
              They&apos;ll show here so you can copy them into reminders.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
