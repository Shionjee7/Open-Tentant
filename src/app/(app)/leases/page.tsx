import Link from "next/link";
import { listLeases } from "@/lib/data";
import { money, shortDate } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Leases" };

export default async function LeasesPage() {
  const leases = await listLeases();
  return (
    <>
      <PageHeader
        title="Leases"
        subtitle="Draft, send for e-signature, activate, and archive leases."
        action={<Link href="/leases/new" className="btn">+ New lease</Link>}
      />
      {leases.length === 0 ? (
        <EmptyState
          title="No leases yet"
          message="Create a lease for a property and its tenants, then send it for e-signature."
          action={<Link href="/leases/new" className="btn">+ New lease</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Property</th>
                <th className="th">Tenants</th>
                <th className="th">Term</th>
                <th className="th">Rent</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.id} className="table-row">
                  <td className="td">
                    <Link href={`/leases/${l.id}`} className="font-medium text-brand-600 hover:underline">
                      {l.property_name}
                    </Link>
                    {l.unit_name && <div className="text-xs text-ink-500">{l.unit_name}</div>}
                  </td>
                  <td className="td">{l.tenant_names ?? "—"}</td>
                  <td className="td">{shortDate(l.start_date)} → {shortDate(l.end_date)}</td>
                  <td className="td">{money(l.rent)}/mo</td>
                  <td className="td"><Badge value={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
