import {
  financialOutlook,
  expensesByCategory,
  listProperties,
  listTransactions,
  monthlyTotals,
  totalsByType,
} from "@/lib/data";
import { createTransaction } from "@/lib/actions";
import { money, moneyExact, monthLabel, shortDate, titleCase } from "@/lib/format";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import IncomeExpenseChart from "@/components/IncomeExpenseChart";

export const metadata = { title: "Accounting" };

export default async function AccountingPage() {
  const txns = await listTransactions();
  const totals = await totalsByType();
  const monthly = (await monthlyTotals(6)).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const byCategory = await expensesByCategory();
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const properties = await listProperties();
  const outlook = await financialOutlook();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Accounting & Insights"
        subtitle="Every payment you approve books itself as income automatically — add expenses to see true profit."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total income" value={money(totals.income)} tone="good" />
        <StatCard label="Total expenses" value={money(totals.expenses)} tone="bad" />
        <StatCard
          label="Net profit"
          value={money(totals.income - totals.expenses)}
          tone={totals.income - totals.expenses >= 0 ? "good" : "bad"}
        />
      </div>

      <section className="card mb-6 p-5">
        <h2 className="font-semibold">Where you stand</h2>
        <p className="mt-1 text-sm text-ink-700">
          {outlook.activeLeaseCount === 0
            ? "No active leases yet, so there's nothing to project from."
            : `Your ${outlook.activeLeaseCount} active lease${outlook.activeLeaseCount === 1 ? "" : "s"} bring in ` +
              `${money(outlook.monthlyRent)} a month. Averaged over the last year, expenses run ` +
              `${money(outlook.monthlyExpenseRate)} a month, leaving about ${money(outlook.monthlyNet)} a month.`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="This month in" value={money(outlook.incomeThisMonth)} tone="good" />
          <StatCard label="This month out" value={money(outlook.expensesThisMonth)} tone="bad" />
          <StatCard
            label="This month net"
            value={money(outlook.netThisMonth)}
            tone={outlook.netThisMonth >= 0 ? "good" : "bad"}
          />
          <StatCard
            label="Money kept so far"
            value={money(outlook.onHand)}
            hint="all income minus all expenses"
          />
        </div>

        {outlook.outstanding > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            {money(outlook.outstanding)} is still owed to you across unpaid and reported payments.
          </p>
        )}

        {outlook.activeLeaseCount > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold">If everything stays as it is today</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Assumes every active lease keeps paying and expenses continue at last year's average.
              A planning aid, not a promise — vacancies and repairs will move these numbers.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[440px]">
                <thead>
                  <tr>
                    <th className="th">Time</th>
                    <th className="th text-right">Rent collected</th>
                    <th className="th text-right">Expenses</th>
                    <th className="th text-right">Net</th>
                    <th className="th text-right">Money kept</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {outlook.projections.map((row) => (
                    <tr key={row.years} className="border-t border-slate-100">
                      <td className="td font-medium">{row.years} year{row.years === 1 ? "" : "s"}</td>
                      <td className="td text-right text-emerald-600">{money(row.rent)}</td>
                      <td className="td text-right text-rose-600">{money(row.expenses)}</td>
                      <td className="td text-right font-medium">{money(row.net)}</td>
                      <td className="td text-right font-semibold">{money(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Income vs expenses — last 6 months</h2>
          {monthly.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">
              No transactions yet — approve a payment or add an expense to see the chart.
            </p>
          ) : (
            <IncomeExpenseChart data={monthly} />
          )}
        </section>

        <section className="card h-fit p-5">
          <h2 className="mb-3 font-semibold">Expenses by category</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-ink-500">No expenses recorded.</p>
          ) : (
            <ul className="space-y-3">
              {byCategory.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{titleCase(c.category)}</span>
                    <span className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(c.total)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max(3, (c.total / maxCat) * 100)}%`, background: "#eb6834" }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3 font-semibold">Transactions</div>
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Property</th>
                <th className="th">Category</th>
                <th className="th">Description</th>
                <th className="th">Type</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr>
                  <td className="td py-8 text-center text-ink-500" colSpan={6}>No transactions yet.</td>
                </tr>
              ) : (
                txns.map((t) => (
                  <tr key={t.id} className="table-row">
                    <td className="td">{shortDate(t.date)}</td>
                    <td className="td">{t.property_name ?? "—"}</td>
                    <td className="td">{titleCase(t.category)}</td>
                    <td className="td max-w-56 truncate">{t.description}</td>
                    <td className="td"><Badge value={t.type} /></td>
                    <td
                      className={`td text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {t.type === "income" ? "+" : "−"}{moneyExact(t.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Add transaction</h2>
          <form action={createTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input name="date" type="date" defaultValue={today} required className="input" />
              </div>
              <div>
                <label className="label">Type</label>
                <select name="type" defaultValue="expense" className="input">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Category</label>
              <select name="category" defaultValue="repairs" className="input">
                <option value="rent">Rent</option>
                <option value="repairs">Repairs</option>
                <option value="utilities">Utilities</option>
                <option value="insurance">Insurance</option>
                <option value="taxes">Taxes</option>
                <option value="mortgage">Mortgage</option>
                <option value="turnover">Turnover</option>
                <option value="software">Software</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Property</label>
              <select name="property_id" className="input" defaultValue="">
                <option value="">Portfolio-wide</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount ($)</label>
              <input name="amount" type="number" min="0" step="0.01" required className="input" />
            </div>
            <div>
              <label className="label">Description</label>
              <input name="description" className="input" />
            </div>
            <button className="btn w-full">Add transaction</button>
          </form>
        </section>
      </div>
    </>
  );
}
