import Link from "next/link";
import { listApplications } from "@/lib/data";
import { money, shortDate } from "@/lib/format";
import { Badge, EmptyState, PageHeader, ProBadge } from "@/components/ui";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const apps = await listApplications();
  return (
    <>
      <PageHeader
        title="Applications"
        subtitle="Rental applications from your public listing pages, with custom questions, income verification, and screening."
        action={<Link href="/settings#questions" className="btn-secondary">Edit custom questions</Link>}
      />
      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          message="Publish a property on your listings page and share the apply link — applications land here automatically."
          action={<Link href="/properties" className="btn">Go to properties</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Applicant</th>
                <th className="th">Property</th>
                <th className="th">Income</th>
                <th className="th">Screening <ProBadge /></th>
                <th className="th">Applied</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const rent = a.unit_rent || a.property_rent;
                const ratio = rent ? a.monthly_income / rent : null;
                return (
                  <tr key={a.id} className="table-row">
                    <td className="td">
                      <Link href={`/applications/${a.id}`} className="font-medium text-brand-600 hover:underline">
                        {a.applicant_name}
                      </Link>
                      <div className="text-xs text-ink-500">{a.applicant_email}</div>
                    </td>
                    <td className="td">
                      {a.property_name ?? "—"}
                      {a.unit_name && (
                        <div className="text-xs text-ink-500">{a.unit_name}</div>
                      )}
                    </td>
                    <td className="td">
                      <div>
                        {money(a.monthly_income)}/mo{" "}
                        {!!a.income_verified && <span title="Income verified" className="text-emerald-600">✓</span>}
                      </div>
                      {ratio !== null && (
                        <div className={`text-xs ${ratio >= 3 ? "text-emerald-600" : "text-amber-600"}`}>
                          {ratio.toFixed(1)}× rent
                        </div>
                      )}
                    </td>
                    <td className="td"><Badge value={a.screening_status} /></td>
                    <td className="td">{shortDate(a.created)}</td>
                    <td className="td"><Badge value={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
