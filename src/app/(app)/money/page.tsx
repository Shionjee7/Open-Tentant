import Link from "next/link";
import { financialOutlook, monthlyLedger, portfolioSummary } from "@/lib/data";
import { money, monthLabel } from "@/lib/format";
import { PageHeader, StartHere } from "@/components/ui";
import MonthlyMoney from "@/components/MonthlyMoney";

export const metadata = { title: "Money" };

/**
 * "How much am I making?" — the whole page.
 *
 * A hero figure for the month you're in, the year underneath it month by month,
 * and links to the three places that change those numbers. Everything else
 * about money used to be four separate menu entries; they're all one hop from
 * here now.
 */
export default async function MoneyPage() {
  const [rows, outlook, summary] = await Promise.all([
    monthlyLedger(12),
    financialOutlook(),
    portfolioSummary(),
  ]);

  const started = rows.some((r) => r.income > 0 || r.expenses > 0);
  const thisMonth = rows[rows.length - 1];
  const finished = rows.filter((r) => !r.current && (r.income > 0 || r.expenses > 0));
  const average =
    finished.length > 0 ? finished.reduce((t, r) => t + r.net, 0) / finished.length : 0;
  const best = finished.reduce<typeof finished[number] | null>(
    (top, r) => (!top || r.net > top.net ? r : top),
    null
  );

  if (!started) {
    return (
      <>
        <PageHeader title="Money" subtitle="What came in, what went out, and what you kept." />
        <StartHere
          title="Nothing to count yet"
          message="Two things fill this page: rent you mark as paid, and a bank statement for the bills. Do those and every month lines up here."
          steps={[
            {
              href: "/properties/new",
              label: "Add a property",
              detail: "Skip if you've already added your houses.",
              done: summary.houses > 0,
            },
            {
              href: "/payments/new",
              label: "Schedule the rent",
              detail: "Set it once for the year, then just tick off who paid.",
              done: outlook.activeLeaseCount > 0,
            },
            {
              href: "/banking",
              label: "Import a bank statement",
              detail: "Bills get sorted into categories; deposits match to tenants.",
            },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Money"
        subtitle="What came in, what went out, and what you kept."
        action={
          <Link href="/reports/portfolio" className="btn-secondary">
            Partner report
          </Link>
        }
      />

      {/* The one number this page exists for. */}
      <section className="card mb-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Kept in {monthLabel(thisMonth.month)} so far
            </div>
            <div
              className={`mt-1 text-4xl font-bold sm:text-5xl ${
                thisMonth.net >= 0 ? "text-ink-900" : "text-rose-700"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {money(thisMonth.net)}
            </div>
            <div className="mt-1 text-sm text-ink-500" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(thisMonth.income)} in · {money(thisMonth.expenses)} out
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Usual month
              </dt>
              <dd
                className="mt-0.5 text-xl font-semibold"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {money(average)}
              </dd>
              <dd className="text-xs text-ink-500">
                across {finished.length} finished month{finished.length === 1 ? "" : "s"}
              </dd>
            </div>
            {best && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Best month
                </dt>
                <dd
                  className="mt-0.5 text-xl font-semibold"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {money(best.net)}
                </dd>
                <dd className="text-xs text-ink-500">{monthLabel(best.month)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Kept all time
              </dt>
              <dd
                className="mt-0.5 text-xl font-semibold"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {money(outlook.onHand)}
              </dd>
              <dd className="text-xs text-ink-500">income minus every expense</dd>
            </div>
          </dl>
        </div>

        {outlook.outstanding > 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            {money(outlook.outstanding)} is still owed to you.{" "}
            <Link href="/payments" className="font-medium underline">
              See who hasn&apos;t paid
            </Link>
          </p>
        )}
      </section>

      {/* The year. */}
      <section className="card mb-5">
        <div className="border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5">
          <h2 className="font-semibold">Month by month</h2>
        </div>
        <div className="pt-3">
          <MonthlyMoney rows={rows} />
        </div>
      </section>

      {/* Everything that changes these numbers, one hop away. */}
      <nav className="grid gap-3 sm:grid-cols-3">
        {[
          ["/payments", "Rent", "Who has paid and who hasn't"],
          ["/banking", "Bank deposits", "Import a statement, sort the bills"],
          ["/accounting", "Every transaction", "The full books, by property"],
        ].map(([href, title, detail]) => (
          <Link
            key={href}
            href={href}
            className="card px-4 py-3.5 transition hover:border-brand-300 hover:shadow"
          >
            <div className="font-medium text-ink-900">{title}</div>
            <div className="mt-0.5 text-sm text-ink-500">{detail}</div>
          </Link>
        ))}
      </nav>
    </>
  );
}
