import {
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

export default function AccountingPage() {
  const txns = listTransactions();
  const totals = totalsByType();
  const monthly = monthlyTotals(6).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const byCategory = expensesByCategory();
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const properties = listProperties();
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
