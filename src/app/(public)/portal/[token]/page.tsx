import { notFound } from "next/navigation";
import {
  activeLeaseForPerson,
  getPersonByToken,
  maintenanceForPerson,
  paymentsForPerson,
} from "@/lib/data";
import { getSetting } from "@/lib/db";
import { portalCreateMaintenance, portalReportPayment } from "@/lib/actions";
import { money, moneyExact, shortDate, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui";

export const metadata = { title: "Tenant portal" };

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const person = getPersonByToken(token);
  if (!person) notFound();

  const lease = activeLeaseForPerson(person.id);
  const payments = paymentsForPerson(person.id);
  const openPayments = payments.filter((p) => p.status === "unpaid");
  const reportedCount = payments.filter((p) => p.status === "reported").length;
  const history = payments.filter((p) => p.status === "paid").slice(0, 12);
  const maintenance = maintenanceForPerson(person.id);
  const instructions = getSetting("payment_instructions");
  const methods = getSetting("payment_methods");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hi, {person.first_name} 👋</h1>
        <p className="mt-1 text-sm text-ink-500">
          {person.property_name ? `Your home: ${person.property_name}` : "Your tenant portal"}
          {lease && ` · lease ${shortDate(lease.start_date)} → ${shortDate(lease.end_date)} · ${money(lease.rent)}/mo`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold">Amount due</h2>
              <p className="text-xs text-ink-500">
                Paid by {methods || "Zelle, card, cash, or check"}? Record it below and your landlord will confirm.
                {reportedCount > 0 && ` ${reportedCount} payment${reportedCount === 1 ? "" : "s"} awaiting confirmation.`}
              </p>
            </div>
            {openPayments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500">You&apos;re all caught up. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openPayments.map((p) => (
                  <li key={p.id} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{moneyExact(p.amount)}</span>{" "}
                        <span className="text-sm text-ink-500">· {titleCase(p.type)} · due {shortDate(p.due_date)}</span>
                      </div>
                      <Badge value={p.due_date < today ? "past_due" : "upcoming"} />
                    </div>
                    <form action={portalReportPayment} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="payment_id" value={p.id} />
                      <div>
                        <label className="label">I paid with</label>
                        <select name="reported_method" className="input w-36" defaultValue="zelle">
                          <option value="zelle">Zelle</option>
                          <option value="venmo">Venmo</option>
                          <option value="card">Credit/debit card</option>
                          <option value="ach">Bank transfer</option>
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">On</label>
                        <input name="reported_date" type="date" defaultValue={today} className="input w-40" />
                      </div>
                      <div className="min-w-40 flex-1">
                        <label className="label">Note / confirmation #</label>
                        <input name="reported_note" className="input" placeholder="Optional" />
                      </div>
                      <button className="btn">I paid this</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold">Payment history</h2>
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-500">No payments recorded yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">Paid</th>
                    <th className="th">Type</th>
                    <th className="th">Method</th>
                    <th className="th">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="td">{shortDate(p.paid_date)}</td>
                      <td className="td">{titleCase(p.type)}</td>
                      <td className="td">{titleCase(p.method || "—")}</td>
                      <td className="td font-medium">{moneyExact(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="font-semibold">Your maintenance requests</h2>
            </div>
            {maintenance.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-500">Nothing reported yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {maintenance.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-ink-500">{shortDate(m.created_at)}</div>
                    </div>
                    <Badge value={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-2 font-semibold">How to pay</h2>
            {instructions ? (
              <p className="whitespace-pre-line text-sm text-ink-700">{instructions}</p>
            ) : (
              <p className="text-sm text-ink-500">Ask your landlord for payment instructions.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Report a problem</h2>
            <form action={portalCreateMaintenance} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <div>
                <label className="label">What&apos;s wrong?</label>
                <input name="title" required className="input" placeholder="Leaking faucet" />
              </div>
              <div>
                <label className="label">Details</label>
                <textarea name="description" rows={3} className="input" placeholder="Where, since when, how bad?" />
              </div>
              <div>
                <label className="label">Urgency</label>
                <select name="priority" defaultValue="medium" className="input">
                  <option value="low">Low — whenever convenient</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent — safety issue</option>
                </select>
              </div>
              <button className="btn w-full">Submit request</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
