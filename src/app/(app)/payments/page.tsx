import Link from "next/link";
import { listPayments, reportedPayments } from "@/lib/data";
import { getSetting } from "@/lib/data";
import {
  approveReportedPayment,
  deletePayment,
  markPaymentPaid,
  rejectReportedPayment,
  sendMonthlyReceipts,
  sendPaymentReminder,
} from "@/lib/actions";
import { money, moneyExact, shortDate, titleCase } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import type { Payment } from "@/lib/types";

export const metadata = { title: "Rent" };

function paymentState(payment: Payment, today: string) {
  if (payment.status === "paid") return "paid";
  if (payment.status === "reported") return "reported";
  return payment.due_date < today ? "past_due" : "upcoming";
}

function PaymentActions({ payment, compact = false }: { payment: Payment; compact?: boolean }) {
  if (payment.status !== "unpaid") return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : "justify-end"}`}>
      <form action={markPaymentPaid} className={`flex items-center gap-2 ${compact ? "min-w-0 flex-1" : ""}`}>
        <input type="hidden" name="id" value={payment.id} />
        <select
          name="method"
          aria-label={`Payment method for ${payment.tenant_name ?? "tenant"}`}
          className={`input px-2 py-1 text-xs ${compact ? "min-w-0 flex-1" : "w-28"}`}
          defaultValue="ach"
        >
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
      <form action={sendPaymentReminder}>
        <input type="hidden" name="id" value={payment.id} />
        <button className="btn-secondary btn-sm" title="Email the tenant a reminder">Remind</button>
      </form>
      <form action={deletePayment}>
        <input type="hidden" name="id" value={payment.id} />
        <button
          className="btn-secondary btn-sm"
          title="Delete unpaid charge"
          aria-label={`Delete unpaid charge for ${payment.tenant_name ?? "tenant"}`}
        >
          ✕
        </button>
      </form>
    </div>
  );
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    receipts?: string;
    noreceipt?: string;
    mail?: string;
    month?: string;
    view?: string;
  }>;
}) {
  const { receipts, noreceipt, mail, month: requestedMonth, view } = await searchParams;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(requestedMonth ?? "") ? requestedMonth! : thisMonth;
  const allPayments = await listPayments();
  const payments = view === "all"
    ? allPayments
    : allPayments.filter((payment) => payment.due_date.startsWith(month));
  const reported = await reportedPayments();
  const methods = await getSetting("payment_methods");
  const today = new Date().toISOString().slice(0, 10);
  const scheduled = payments.reduce((total, payment) => total + payment.amount, 0);
  const received = payments
    .filter((payment) => payment.status === "paid")
    .reduce((total, payment) => total + payment.amount, 0);
  const outstanding = payments
    .filter((payment) => payment.status !== "paid")
    .reduce((total, payment) => total + payment.amount, 0);
  const paidCount = payments.filter((payment) => payment.status === "paid").length;

  return (
    <>
      <PageHeader
        title="Rent"
        subtitle="See who paid, match deposits, and follow up on what is still due."
        action={<Link href="/payments/new" className="btn">+ Record / schedule</Link>}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <form method="GET" className="flex items-end gap-2">
          <div>
            <label className="label">Month</label>
            <input name="month" type="month" defaultValue={month} className="input w-44" />
          </div>
          <button className="btn-secondary">View</button>
        </form>
        {view === "all" ? (
          <Link href={`/payments?month=${month}`} className="text-sm font-medium text-brand-600 hover:underline">
            Show one month
          </Link>
        ) : (
          <Link href="/payments?view=all" className="text-sm font-medium text-brand-600 hover:underline">
            Show all charges
          </Link>
        )}
      </div>

      {(receipts || mail) && (
        <div className="card mb-5 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {receipts && (
            <>
              Emailed <strong>{receipts}</strong> receipt{receipts === "1" ? "" : "s"}
              {noreceipt && Number(noreceipt) > 0 &&
                ` · skipped ${noreceipt} (nothing paid that month, or no email address)`}.
            </>
          )}
          {mail === "sent" && "Reminder sent."}
          {mail === "failed" && "Couldn't send — check your email settings."}
          {mail === "noaddress" && "That tenant has no email address."}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Scheduled" value={money(scheduled)} hint={view === "all" ? "all charges" : month} />
        <StatCard label="Received" value={money(received)} tone="good" />
        <StatCard label="Still owed" value={money(outstanding)} tone={outstanding > 0 ? "bad" : "default"} />
        <StatCard label="Marked paid" value={`${paidCount}/${payments.length}`} hint="scheduled items" />
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
          title={view === "all" ? "No payments yet" : "Nothing scheduled for this month"}
          message="Schedule rent for a lease once, then compare each month with the deposits in your bank statement."
          action={<Link href="/payments/new" className="btn">+ Record / schedule</Link>}
        />
      ) : (
        <>
          <ul className="card divide-y divide-slate-100 md:hidden">
            {payments.map((payment) => (
              <li key={payment.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-900">
                      {payment.tenant_name ?? "No tenant"}
                    </div>
                    <div className="truncate text-sm text-ink-500">
                      {payment.property_name ?? "No property"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{moneyExact(payment.amount)}</div>
                    <Badge value={paymentState(payment, today)} />
                  </div>
                </div>
                <div className="mt-2 text-sm text-ink-700">
                  {titleCase(payment.type)} · due {shortDate(payment.due_date)}
                  {payment.paid_date && (
                    <span className="text-ink-500"> · paid {shortDate(payment.paid_date)} via {payment.method}</span>
                  )}
                </div>
                <PaymentActions payment={payment} compact />
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto md:block">
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
                return (
                  <tr key={p.id} className="table-row">
                    <td className="td">{shortDate(p.due_date)}</td>
                    <td className="td">{p.tenant_name ?? "—"}</td>
                    <td className="td">{p.property_name ?? "—"}</td>
                    <td className="td">{titleCase(p.type)}</td>
                    <td className="td font-medium">{moneyExact(p.amount)}</td>
                    <td className="td">
                      <Badge
                        value={paymentState(p, today)}
                      />
                      {p.paid_date && (
                        <div className="mt-0.5 text-xs text-ink-500">{shortDate(p.paid_date)} · {p.method}</div>
                      )}
                    </td>
                    <td className="td text-right">
                      <PaymentActions payment={p} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer font-semibold">Send month-end receipts</summary>
        <p className="mt-2 text-xs text-ink-500">
          Emails each tenant an itemized receipt for what they actually paid.
          {methods ? ` Your accepted methods are ${methods}.` : " Add your payment methods in Settings."}
        </p>
        <form action={sendMonthlyReceipts} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Month</label>
            <input name="month" type="month" defaultValue={month} className="input w-48" />
          </div>
          <button className="btn">Send receipts</button>
        </form>
      </details>
    </>
  );
}
