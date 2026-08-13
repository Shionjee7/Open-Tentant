import Link from "next/link";
import { getSetting, monthlyPortfolioReport } from "@/lib/data";
import { money, monthLabel } from "@/lib/format";
import { BackLink, PageHeader, StatCard } from "@/components/ui";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Portfolio report" };

export default async function PortfolioReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: requestedMonth } = await searchParams;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(requestedMonth ?? "") ? requestedMonth! : currentMonth;
  const [report, businessName] = await Promise.all([
    monthlyPortfolioReport(month),
    getSetting("business_name", "OpenTenant portfolio"),
  ]);

  return (
    <>
      <div className="no-print">
        <BackLink href="/accounting" label="Accounting" />
      </div>
      <PageHeader
        title="Portfolio report"
        subtitle={`${businessName} · ${monthLabel(month)}`}
        action={<PrintButton />}
      />

      <form method="GET" className="no-print mb-6 flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="label">Report month</label>
          <input name="month" type="month" defaultValue={month} className="input w-44" />
        </div>
        <button className="btn-secondary">Update</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Rent scheduled" value={money(report.scheduledRent)} />
        <StatCard label="Money received" value={money(report.received)} tone="good" />
        <StatCard label="Expenses" value={money(report.expenses)} tone="bad" />
        <StatCard label="Net" value={money(report.net)} tone={report.net >= 0 ? "good" : "bad"} />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Each property</h2>
          <p className="mt-0.5 text-sm text-ink-500">Actual money recorded during {monthLabel(month)}.</p>
        </div>
        <ul className="divide-y divide-slate-100 md:hidden" style={{ fontVariantNumeric: "tabular-nums" }}>
          {report.rows.map((row) => (
            <li key={row.property.id} className="p-4">
              <Link href={`/properties/${row.property.id}`} className="font-semibold hover:text-brand-600">
                {row.property.name}
              </Link>
              <div className="mt-0.5 text-xs text-ink-500">
                {row.rooms > 0 ? `${row.roomsOccupied}/${row.rooms} rooms filled` : row.property.status}
                {` · ${row.tenants} tenant${row.tenants === 1 ? "" : "s"}`}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-500">Scheduled</dt>
                  <dd className="font-medium">{money(row.scheduledRent)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Received</dt>
                  <dd className="font-medium text-emerald-600">{money(row.received)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Expenses</dt>
                  <dd className="font-medium text-rose-600">{money(row.expenses)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Net</dt>
                  <dd className={`font-semibold ${row.net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {money(row.net)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Still owed</dt>
                  <dd className="font-medium">{money(row.outstanding)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="th">Property</th>
                <th className="th text-right">Scheduled</th>
                <th className="th text-right">Received</th>
                <th className="th text-right">Expenses</th>
                <th className="th text-right">Net</th>
                <th className="th text-right">Still owed</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {report.rows.map((row) => (
                <tr key={row.property.id} className="table-row">
                  <td className="td">
                    <Link href={`/properties/${row.property.id}`} className="font-medium hover:text-brand-600">
                      {row.property.name}
                    </Link>
                    <div className="text-xs text-ink-500">
                      {row.rooms > 0 ? `${row.roomsOccupied}/${row.rooms} rooms filled` : row.property.status}
                      {` · ${row.tenants} tenant${row.tenants === 1 ? "" : "s"}`}
                    </div>
                  </td>
                  <td className="td text-right">{money(row.scheduledRent)}</td>
                  <td className="td text-right text-emerald-600">{money(row.received)}</td>
                  <td className="td text-right text-rose-600">{money(row.expenses)}</td>
                  <td className={`td text-right font-semibold ${row.net < 0 ? "text-rose-600" : ""}`}>{money(row.net)}</td>
                  <td className="td text-right">{money(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Items to verify</h2>
          <p className={`mt-1 text-2xl font-bold ${report.needsReview ? "text-amber-700" : "text-emerald-700"}`}>
            {report.needsReview}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Statement deposits, bills, or possible duplicates still waiting for review.
          </p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Portfolio-wide activity</h2>
          <p className="mt-1 text-sm text-ink-700">
            {money(report.unassignedIncome)} income and {money(report.unassignedExpenses)} expenses were not assigned to one property.
          </p>
        </section>
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Prepared {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
        Figures reflect records entered and statement items reviewed in OpenTenant; verify against source statements before formal reporting.
      </p>
    </>
  );
}
