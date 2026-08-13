import Link from "next/link";
import { money } from "@/lib/format";
import type { PropertyOutlook } from "@/lib/data";

/**
 * One row per house: what it brings in, what it costs, what's left — this
 * month, this year, and running forward at today's rate.
 *
 * The "per month" and "per year" columns are the current run rate (active
 * leases minus the trailing expense average), not what has actually landed;
 * "this year" is what actually happened. Both matter, and confusing them is
 * how people end up surprised, so they're labelled apart.
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <th className="th">Property</th>
            <th className="th text-right">Rent / month</th>
            <th className="th text-right">Costs / month</th>
            <th className="th text-right">Net / month</th>
            <th className="th text-right">Net / year</th>
            <th className="th text-right">Kept this year</th>
            <th className="th text-right">Net over 5 years</th>
          </tr>
        </thead>
        <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
          {rows.map(({ property, outlook, rooms, roomsOccupied, tenantCount }) => (
            <tr key={property.id} className="table-row">
              <td className="td">
                <Link href={`/properties/${property.id}`} className="font-medium hover:text-brand-600">
                  {property.name}
                </Link>
                <div className="text-xs text-ink-500">
                  {rooms > 0
                    ? `${roomsOccupied} of ${rooms} rooms filled`
                    : property.status === "occupied"
                      ? "Whole place, rented"
                      : "Whole place, vacant"}
                  {tenantCount > 0 && ` · ${tenantCount} tenant${tenantCount === 1 ? "" : "s"}`}
                </div>
              </td>
              <td className="td text-right text-emerald-600">{money(outlook.monthlyRent)}</td>
              <td className="td text-right text-rose-600">{money(outlook.monthlyExpenseRate)}</td>
              <td
                className={`td text-right font-medium ${
                  outlook.monthlyNet >= 0 ? "text-ink-900" : "text-rose-600"
                }`}
              >
                {money(outlook.monthlyNet)}
              </td>
              <td className="td text-right">{money(outlook.yearlyNet)}</td>
              <td className="td text-right">{money(outlook.netThisYear)}</td>
              <td className="td text-right font-semibold">{money(outlook.projections[4].net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 font-semibold">
            <td className="td">All properties</td>
            <td className="td text-right text-emerald-600">{money(totals.monthlyRent)}</td>
            <td className="td text-right text-rose-600">{money(totals.monthlyExpenseRate)}</td>
            <td className="td text-right">{money(totals.monthlyNet)}</td>
            <td className="td text-right">{money(totals.yearlyNet)}</td>
            <td className="td text-right">{money(totals.netThisYear)}</td>
            <td className="td text-right">{money(totals.fiveYear)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
