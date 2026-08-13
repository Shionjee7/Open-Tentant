import Link from "next/link";
import { money } from "@/lib/format";
import type { PropertyOutlook } from "@/lib/data";

/**
 * What each house earns, one card per property.
 *
 * This was a seven-column table, which meant three of the columns sat off the
 * right edge of a phone — and they were the ones worth reading. Cards in a grid
 * show every figure at any width, and a landlord with a handful of houses
 * compares them just as easily. The full ledger lives in the partner report.
 *
 * Deliberately one layout rather than a table for wide screens and cards for
 * narrow ones: rendering both would put every number in the document twice,
 * which breaks find-in-page and copy/paste for the sake of a spreadsheet
 * nobody asked for.
 *
 * "Per month" and "per year" are the current run rate — today's leases minus
 * that property's average costs. "Kept this year" is what actually landed.
 * Confusing the two is how people end up surprised, so they're labelled apart.
 */
export default function PropertyMoneyTable({ rows }: { rows: PropertyOutlook[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-500">
        Add a property and its numbers appear here.
      </p>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      monthlyRent: acc.monthlyRent + r.outlook.monthlyRent,
      monthlyExpenseRate: acc.monthlyExpenseRate + r.outlook.monthlyExpenseRate,
      monthlyNet: acc.monthlyNet + r.outlook.monthlyNet,
      yearlyNet: acc.yearlyNet + r.outlook.yearlyNet,
      netThisYear: acc.netThisYear + r.outlook.netThisYear,
      fiveYear: acc.fiveYear + r.outlook.projections[4].net,
    }),
    { monthlyRent: 0, monthlyExpenseRate: 0, monthlyNet: 0, yearlyNet: 0, netThisYear: 0, fiveYear: 0 }
  );

  const Figure = ({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) => (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className={tone === "in" ? "text-emerald-600" : tone === "out" ? "text-rose-600" : ""}>
        {value}
      </dd>
    </div>
  );

  return (
    <div className="p-4 sm:p-5">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ property, outlook, rooms, roomsOccupied, tenantCount }) => (
          <li key={property.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/properties/${property.id}`}
                className="truncate font-medium hover:text-brand-600"
              >
                {property.name}
              </Link>
              <span
                className={`shrink-0 text-lg font-bold ${
                  outlook.monthlyNet >= 0 ? "text-ink-900" : "text-rose-600"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {money(outlook.monthlyNet)}
                <span className="ml-1 text-xs font-normal text-ink-500">/mo</span>
              </span>
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {rooms > 0
                ? `${roomsOccupied} of ${rooms} rooms filled`
                : property.status === "occupied"
                  ? "Whole place, rented"
                  : "Whole place, vacant"}
              {tenantCount > 0 && ` · ${tenantCount} tenant${tenantCount === 1 ? "" : "s"}`}
            </div>
            <dl
              className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <Figure label="Rent a month" value={money(outlook.monthlyRent)} tone="in" />
              <Figure label="Costs a month" value={money(outlook.monthlyExpenseRate)} tone="out" />
              <Figure label="Net a year" value={money(outlook.yearlyNet)} />
              <Figure label="Kept this year" value={money(outlook.netThisYear)} />
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-1.5 font-medium">
                <dt>Net over 5 years</dt>
                <dd>{money(outlook.projections[4].net)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {rows.length > 1 && (
        <dl
          className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <div className="flex items-baseline justify-between gap-3 font-semibold">
            <dt>All {rows.length} properties</dt>
            <dd className="text-lg">
              {money(totals.monthlyNet)}
              <span className="ml-1 text-xs font-normal text-ink-500">/mo</span>
            </dd>
          </div>
          <div className="mt-2 grid gap-x-6 gap-y-1 border-t border-slate-200 pt-2 sm:grid-cols-2">
            <Figure label="Rent a month" value={money(totals.monthlyRent)} tone="in" />
            <Figure label="Costs a month" value={money(totals.monthlyExpenseRate)} tone="out" />
            <Figure label="Net a year" value={money(totals.yearlyNet)} />
            <Figure label="Net over 5 years" value={money(totals.fiveYear)} />
          </div>
        </dl>
      )}
    </div>
  );
}
