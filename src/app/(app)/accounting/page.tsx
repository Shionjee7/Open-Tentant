import Link from "next/link";
import {
  accountBalances,
  expensesByCategory,
  listProperties,
  listTransactions,
  monthlyTotals,
  portfolioSummary,
  totalsByType,
} from "@/lib/data";
import { createTransaction } from "@/lib/actions";
import { money, moneyExact, monthLabel, shortDate, titleCase } from "@/lib/format";
import { Badge, PageHeader, StartHere, StatCard } from "@/components/ui";
import IncomeExpenseChart from "@/components/IncomeExpenseChart";
import PropertyMoneyTable from "@/components/PropertyMoneyTable";

export const metadata = { title: "Accounting" };

export default async function AccountingPage() {
  const txns = await listTransactions();
  const totals = await totalsByType();
  const monthly = (await monthlyTotals(6)).map((m) => ({ ...m, label: monthLabel(m.month) }));
  const byCategory = await expensesByCategory();
  const maxCat = Math.max(1, ...byCategory.map((c) => c.total));
  const properties = await listProperties();
  const summary = await portfolioSummary();
  const outlook = summary.portfolio;
  const balances = await accountBalances();
  const today = new Date().toISOString().slice(0, 10);

  // Nothing has happened yet, so there is nothing to account for. Showing the
  // full page here means six $0 tiles, an empty chart, and three empty tables.
  const hasBooks = txns.length > 0;
  // A year of rent and bills is hundreds of rows, and nobody scrolls them. Show
  // the recent ones; the partner report has the full ledger.
  const RECENT = 15;
  const recentTxns = txns.slice(0, RECENT);
  if (!hasBooks && summary.houses === 0) {
    return (
      <>
        <PageHeader
          title="Accounting"
          subtitle="Rent in, costs out, and what's left — once there's something to count."
        />
        <StartHere
          title="Your books start with a property"
          message="Rent you approve books itself as income, and bank statements fill in the costs. Three steps and this page fills itself in."
          steps={[
            {
              href: "/properties/new",
              label: "Add a property",
              detail: "The house or apartment you rent out — rooms too, if you let them separately.",
            },
            {
              href: "/payments/new",
              label: "Schedule the rent",
              detail: "Set it once for the year, and every month tracks itself.",
            },
            {
              href: "/banking",
              label: "Import a bank statement",
              detail: "Deposits match to tenants; bills sort themselves into expense categories.",
            },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="Every payment you approve books itself as income automatically — add expenses to see true profit."
        action={<Link href="/reports/portfolio" className="btn">Partner report</Link>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total income" value={money(totals.income)} tone="good" />
        <StatCard
          label="Total expenses"
          value={money(totals.expenses)}
          tone={totals.expenses > 0 ? "bad" : "default"}
        />
        <StatCard
          label="Net profit"
          value={money(totals.income - totals.expenses)}
          tone={totals.income - totals.expenses >= 0 ? "good" : "bad"}
        />
      </div>

      {/* What you own */}
      <section className="card mb-6 p-5">
        <h2 className="font-semibold">What you own</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Properties"
            value={String(summary.houses)}
            hint={`${summary.housesOccupied} rented`}
          />
          <StatCard
            label={summary.rooms > 0 ? "Rooms" : "By the room"}
            value={summary.rooms > 0 ? String(summary.rooms) : "—"}
            hint={
              summary.rooms > 0
                ? `${summary.roomsOccupied} filled, across ${summary.byRoomHouses} house${summary.byRoomHouses === 1 ? "" : "s"}`
                : "no room rentals yet"
            }
          />
          <StatCard label="Tenants" value={String(summary.tenants)} />
          <StatCard
            label="Rent per month"
            value={money(outlook.monthlyRent)}
            tone="good"
            hint={`${outlook.activeLeaseCount} active lease${outlook.activeLeaseCount === 1 ? "" : "s"}`}
          />
        </div>
      </section>

      {/* Per property */}
      <section className="card mb-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold">Each property</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            What every house earns after its own costs. <em>Per month</em> and <em>per year</em> are
            the current run rate — today&apos;s leases, minus that property&apos;s average costs.{" "}
            <em>Kept this year</em> is what actually landed.
          </p>
        </div>
        <PropertyMoneyTable rows={summary.properties} />
        {summary.unassignedExpenses > 0 && (
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-ink-500">
            {money(summary.unassignedExpenses)} of expenses aren&apos;t tied to a property
            (portfolio-wide insurance, software, and so on), so they sit outside these rows and are
            counted in the totals below. Pick a property when adding an expense to see it here.
          </p>
        )}
      </section>

      {/* Money in the bank */}
      {balances.length > 0 && (
        <section className="card mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Money in the bank</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Each account carried forward from the balance you set, plus deposits imported since,
              minus what its property spent.
            </p>
          </div>
          {/* One layout at every width. A table here would push "balance now" —
              the only column anyone opens this for — off the side of a phone. */}
          <ul className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {balances.map((row) => (
              <li key={row.account.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">
                    {row.account.name}
                    {row.account.last4 && (
                      <span className="text-ink-500"> ····{row.account.last4}</span>
                    )}
                  </span>
                  <span
                    className="shrink-0 text-lg font-bold"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {money(row.balance)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-500">
                  {row.account.property_name ?? "All properties"}
                </div>
                {!row.known && (
                  <div className="mt-1 text-xs text-amber-700">
                    No starting balance set — this is movement only
                  </div>
                )}
                <dl
                  className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Starting balance</dt>
                    <dd>{row.known ? money(row.account.opening_balance || 0) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Deposits in</dt>
                    <dd className={row.depositsIn > 0 ? "text-emerald-600" : ""}>{money(row.depositsIn)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Spent</dt>
                    <dd className={row.expensesOut > 0 ? "text-rose-600" : ""}>{money(row.expensesOut)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {balances.length > 1 && (
            <div className="mx-4 mb-4 flex items-baseline justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 font-semibold sm:mx-5 sm:mb-5">
              <span>Across all accounts</span>
              <span className="text-lg" style={{ fontVariantNumeric: "tabular-nums" }}>
                {money(balances.reduce((total, row) => total + row.balance, 0))}
              </span>
            </div>
          )}

          <p className="border-t border-slate-100 px-5 py-3 text-xs text-ink-500">
            Set each account&apos;s starting balance under{" "}
            <Link href="/banking" className="text-brand-600 hover:underline">
              Bank deposits
            </Link>
            , then import statements to keep it current.
          </p>
        </section>
      )}

      {hasBooks && (
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
      )}

      {/* An axis with no bars under it isn't a chart, so it waits for data. */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Income vs expenses — last 6 months</h2>
          {hasBooks ? (
            <IncomeExpenseChart data={monthly} />
          ) : (
            <p className="py-8 text-center text-sm text-ink-500">
              Approve a rent payment or add an expense and the last six months appear here.
            </p>
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
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <span className="font-semibold">
              {txns.length > RECENT ? `Latest ${RECENT} transactions` : "Transactions"}
            </span>
            {txns.length > RECENT && (
              <Link href="/reports/portfolio" className="text-sm text-brand-600 hover:underline">
                All {txns.length} in the report →
              </Link>
            )}
          </div>
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
                recentTxns.map((t) => (
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
