import Link from "next/link";
import { notFound } from "next/navigation";
import { getLease, getPerson, leaseTenantIds, listPayments } from "@/lib/data";
import { setLeaseStatus } from "@/lib/actions";
import { money, shortDate, titleCase } from "@/lib/format";
import { Badge, BackLink, PageHeader } from "@/components/ui";
import SigningPanel from "@/components/SigningPanel";
import type { Person } from "@/lib/types";

export const metadata = { title: "Lease" };

/**
 * Status shortcuts for a lease that was handled outside the app — signed on
 * paper, say. The real signing flow lives in the panel below, so these are
 * worded as bookkeeping ("mark as…") to keep the two apart.
 */
const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  draft: [{ status: "active", label: "Skip signing — activate now" }],
  sent: [{ status: "signed", label: "Mark as signed" }],
  signed: [{ status: "active", label: "Activate lease" }],
  active: [{ status: "ended", label: "End lease" }],
  ended: [{ status: "active", label: "Reactivate" }],
};

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ esign?: string }>;
}) {
  const { id } = await params;
  const { esign } = await searchParams;
  const lease = await getLease(id);
  if (!lease) notFound();

  const payments = (await listPayments()).filter((p) => p.lease === lease.id);
  const transitions = TRANSITIONS[lease.status] ?? [];
  const tenants = (await Promise.all((await leaseTenantIds(lease.id)).map((personId) => getPerson(personId)))).filter((p): p is Person => Boolean(p));

  return (
    <>
      <BackLink href="/leases" label="Leases" />
      <PageHeader
        title={`Lease — ${lease.property_name}${lease.unit_name ? ` · ${lease.unit_name}` : ""}`}
        subtitle={`${lease.tenant_names ?? "No tenants"} · ${shortDate(lease.start_date)} → ${shortDate(lease.end_date)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge value={lease.status} />
            {transitions.map((t) => (
              <form key={t.status} action={setLeaseStatus}>
                <input type="hidden" name="id" value={lease.id} />
                <input type="hidden" name="status" value={t.status} />
                <button className="btn btn-sm">{t.label}</button>
              </form>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Monthly rent</div>
          <div className="text-xl font-bold">{money(lease.rent)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Deposit</div>
          <div className="text-xl font-bold">{money(lease.deposit)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">E-sign</div>
          <div className="text-xl font-bold">
            {lease.esign_provider ? titleCase(lease.esign_provider) : "—"}
          </div>
          {lease.esign_url && (
            <a href={lease.esign_url} target="_blank" className="text-xs text-brand-600 hover:underline">
              Open signing link ↗
            </a>
          )}
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Property</div>
          <Link href={`/properties/${lease.property}`} className="text-xl font-bold text-brand-600 hover:underline">
            View →
          </Link>
        </div>
      </div>

      {lease.notes && (
        <div className="card mb-6 p-4 text-sm">
          <span className="font-semibold">Notes: </span>{lease.notes}
        </div>
      )}

      <div className="mb-6">
        <SigningPanel lease={lease} tenants={tenants} notice={esign} />
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">Payments on this lease</h2>
          <Link href="/payments/new" className="text-sm text-brand-600 hover:underline">+ Schedule payments</Link>
        </div>
        {payments.length === 0 ? (
          <p className="px-4 py-5 text-sm text-ink-500">
            No payments yet. Schedule the monthly rent so it shows up on the dashboard.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Due</th>
                <th className="th">Type</th>
                <th className="th">Amount</th>
                <th className="th">Paid</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const pastDue = p.status === "unpaid" && new Date(p.due_date) < new Date();
                return (
                  <tr key={p.id} className="table-row">
                    <td className="td">{shortDate(p.due_date)}</td>
                    <td className="td">{titleCase(p.type)}</td>
                    <td className="td">{money(p.amount)}</td>
                    <td className="td">{p.paid_date ? `${shortDate(p.paid_date)} (${p.method})` : "—"}</td>
                    <td className="td">
                      <Badge value={p.status === "paid" ? "paid" : pastDue ? "past_due" : "upcoming"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
