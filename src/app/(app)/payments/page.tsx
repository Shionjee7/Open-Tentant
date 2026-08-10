import Link from "next/link";
import { listPayments, reportedPayments, sumPaid, sumPastDue } from "@/lib/data";
import { getSetting } from "@/lib/data";
import {
  approveReportedPayment,
  deletePayment,
  markPaymentPaid,
  rejectReportedPayment,
} from "@/lib/actions";
import { money, moneyExact, shortDate, titleCase } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const payments = await listPayments();
  const reported = await reportedPayments();
  const methods = await getSetting("payment_methods");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={
          methods
            ? `Accepted methods: ${methods}. Change them in Settings.`
            : "Record and schedule rent, deposits, and fees. Set up your accepted payment methods in Settings."
        }
        action={<Link href="/payments/new" className="btn">+ Record / schedule</Link>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Collected this month" value={money(await sumPaid("month"))} tone="good" />
        <StatCard label="Collected this year" value={money(await sumPaid("year"))} tone="good" />
        <StatCard label="Past due" value={money(await sumPastDue())} tone={await sumPastDue() > 0 ? "bad" : "default"} />
      </div>

      {reported.length > 0 && (
        <section className="card mb-6 border-violet-200">
          <div className="border-b border-violet-100 bg-violet-50/60 px-4 py-3">
            <h2 className="font-semibold text-violet-900">
              Tenant-reported payments — needs your approval ({reported.length})
            </h2>
            <p className="text-xs text-violet-700">
              Tenants recorded these from their portal (Zelle, cash, card, check…). Approve to mark paid and book the income.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {reported.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {p.tenant_name ?? "—"} · {moneyExact(p.amount)} · {titleCase(p.type)}
                  </div>
                  <div className="text-xs text-ink-500">
                    {p.property_name ?? "No property"} · due {shortDate(p.due_date)} · says they paid{" "}
                    {shortDate(p.reported_date)} via <span className="font-medium">{titleCase(p.reported_method)}</span>
                    {p.reported_note && <> · “{p.reported_note}”</>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={approveReportedPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-sm bg-emerald-600 hover:bg-emerald-700">Approve</button>
                  </form>
                  <form action={rejectReportedPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-secondary btn-sm">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Schedule monthly rent for a lease and mark payments as they arrive — collected totals and past-due alerts flow to the dashboard automatically."
          action={<Link href="/payments/new" className="btn">+ Record / schedule</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="th">Due</th>
                <th className="th">Tenant</th>
                <th className="th">Property</th>
                <th className="th">Type</th>
                <th className="th">Amount</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const pastDue = p.status === "unpaid" && p.due_date < today;
                return (
                  <tr key={p.id} className="table-row">
                    <td className="td">{shortDate(p.due_date)}</td>
                    <td className="td">{p.tenant_name ?? "—"}</td>
                    <td className="td">{p.property_name ?? "—"}</td>
                    <td className="td">{titleCase(p.type)}</td>
                    <td className="td font-medium">{moneyExact(p.amount)}</td>
                    <td className="td">
                      <Badge
                        value={
                          p.status === "paid"
                            ? "paid"
                            : p.status === "reported"
                              ? "reported"
                              : pastDue
                                ? "past_due"
                                : "upcoming"
                        }
                      />
                      {p.paid_date && (
                        <div className="mt-0.5 text-xs text-ink-500">{shortDate(p.paid_date)} · {p.method}</div>
                      )}
                    </td>
                    <td className="td text-right">
                      {p.status === "unpaid" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <form action={markPaymentPaid} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={p.id} />
                            <select name="method" className="input w-28 px-2 py-1 text-xs" defaultValue="ach">
                              <option value="ach">ACH</option>
                              <option value="zelle">Zelle</option>
                              <option value="venmo">Venmo</option>
                              <option value="cash">Cash</option>
                              <option value="check">Check</option>
                              <option value="card">Card</option>
                              <option value="other">Other</option>
                            </select>
                            <button className="btn btn-sm">Mark paid</button>
                          </form>
                          <form action={deletePayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn-secondary btn-sm" title="Delete unpaid payment">✕</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
