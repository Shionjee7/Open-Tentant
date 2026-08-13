import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProperty,
  listLeases,
  listMaintenance,
  listPeople,
  listUnits,
  propertyOutlooks,
} from "@/lib/data";
import { archiveProperty } from "@/lib/actions";
import { money, shortDate, titleCase } from "@/lib/format";
import { Badge, BackLink, PageHeader, StatCard } from "@/components/ui";
import RoomsPanel from "@/components/RoomsPanel";
import ConfirmButton from "@/components/ConfirmButton";

export const metadata = { title: "Property" };

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, error } = await searchParams;
  const property = await getProperty(id);
  if (!property) notFound();

  const leases = (await listLeases()).filter((l) => l.property === property.id);
  const maintenance = (await listMaintenance()).filter((m) => m.property === property.id);
  const tenants = (await listPeople("tenant")).filter((p) => p.property === property.id);
  const byRoom = property.rental_type === "by_room";
  const tab = rawTab === "rooms" && byRoom ? "rooms" : rawTab === "activity" ? "activity" : "overview";
  const rooms = byRoom ? await listUnits(property.id) : [];
  const mine = (await propertyOutlooks()).find((o) => o.property.id === property.id);
  // Anyone who could move into a room: current tenants plus approved applicants.
  const roomCandidates = byRoom
    ? (await listPeople()).filter((p) => p.stage === "tenant" || p.stage === "applicant")
    : [];

  return (
    <>
      <BackLink href="/properties" label="Properties" />
      <PageHeader
        title={property.name}
        subtitle={`${property.address}${property.city ? `, ${property.city}` : ""}${property.state ? `, ${property.state}` : ""} ${property.zip}`}
        action={
          <div className="flex items-center gap-2">
            <Badge value={property.status} />
            <Link href={`/properties/${property.id}/edit`} className="btn-secondary btn-sm">
              Edit
            </Link>
            {!!property.listed && (
              <Link href={`/apply/${property.id}`} target="_blank" className="btn-secondary btn-sm">
                Public application ↗
              </Link>
            )}
          </div>
        }
      />

      {error === "occupied" && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Move out the current tenants and end active signing or lease work before removing this property.
        </div>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Property sections">
        {[
          ["overview", "Overview"],
          ...(byRoom ? [["rooms", `Rooms (${rooms.length})`]] : []),
          ["activity", `Leases & repairs (${leases.length + maintenance.length})`],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === "overview" ? `/properties/${property.id}` : `/properties/${property.id}?tab=${value}`}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === value
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">
            {byRoom ? "Rooms" : "Rent"}
          </div>
          <div className="text-xl font-bold">
            {byRoom
              ? `${rooms.filter((r) => r.status === "occupied").length}/${rooms.length} filled`
              : `${money(property.rent)}/mo`}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">
            {byRoom ? "Rent roll" : "Deposit"}
          </div>
          <div className="text-xl font-bold">
            {byRoom
              ? `${money(rooms.reduce((s, r) => s + (r.status === "occupied" ? r.rent : 0), 0))}/mo`
              : money(property.deposit)}
          </div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Layout</div>
          <div className="text-xl font-bold">{property.beds} bd / {property.baths} ba</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Type</div>
          <div className="text-xl font-bold">{titleCase(property.type)}</div>
        </div>
      </div>

      {mine && (
        <section className="card mb-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">What this property makes</h2>
            <Link href="/accounting" className="text-sm text-brand-600 hover:underline">
              Compare with your others →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-700">
            {mine.outlook.activeLeaseCount === 0
              ? "No active lease here yet, so there's nothing to project from."
              : `${money(mine.outlook.monthlyRent)} a month in rent, less about ` +
                `${money(mine.outlook.monthlyExpenseRate)} a month in costs, leaves ` +
                `${money(mine.outlook.monthlyNet)} a month — ${money(mine.outlook.yearlyNet)} a year.`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Net per month" value={money(mine.outlook.monthlyNet)}
              tone={mine.outlook.monthlyNet >= 0 ? "good" : "bad"} />
            <StatCard label="Net per year" value={money(mine.outlook.yearlyNet)}
              tone={mine.outlook.yearlyNet >= 0 ? "good" : "bad"} />
            <StatCard label="Kept this year" value={money(mine.outlook.netThisYear)}
              hint="what actually landed" />
            <StatCard label="Kept all time" value={money(mine.outlook.onHand)} />
          </div>

          {mine.outlook.activeLeaseCount > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr>
                    <th className="th">If it stays like this</th>
                    <th className="th text-right">Rent</th>
                    <th className="th text-right">Costs</th>
                    <th className="th text-right">Net</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {mine.outlook.projections.map((row) => (
                    <tr key={row.years} className="border-t border-slate-100">
                      <td className="td font-medium">
                        {row.years} year{row.years === 1 ? "" : "s"}
                      </td>
                      <td className="td text-right text-emerald-600">{money(row.rent)}</td>
                      <td className="td text-right text-rose-600">{money(row.expenses)}</td>
                      <td className="td text-right font-semibold">{money(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-2 text-xs text-ink-500">
            Costs are this property&apos;s own expenses, averaged over the last twelve months.
            Portfolio-wide expenses aren&apos;t counted here — they&apos;re in Accounting.
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">Current tenants</div>
            {tenants.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-500">No tenants assigned.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tenants.map((t) => (
                  <li key={t.id} className="px-4 py-3 text-sm">
                    <div className="font-medium">{t.first_name} {t.last_name}</div>
                    <div className="text-xs text-ink-500">{t.email} · {t.phone}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">Property details</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
              <div><dt className="text-xs text-ink-500">Rental</dt><dd className="font-medium">{byRoom ? "By the room" : "Whole property"}</dd></div>
              <div><dt className="text-xs text-ink-500">Type</dt><dd className="font-medium">{titleCase(property.type)}</dd></div>
              <div><dt className="text-xs text-ink-500">Bedrooms</dt><dd className="font-medium">{property.beds || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Bathrooms</dt><dd className="font-medium">{property.baths || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Square feet</dt><dd className="font-medium">{property.sqft ? property.sqft.toLocaleString() : "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Public listing</dt><dd className="font-medium">{property.listed ? "On" : "Off"}</dd></div>
            </dl>
          </section>
      </div>
      <details className="mt-8 border-t border-slate-200 pt-4 text-sm">
        <summary className="cursor-pointer text-ink-500 hover:text-ink-900">Property options</summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3">
          <span className="text-xs text-ink-500">Removal is reversible and keeps leases and accounting history.</span>
          <form action={archiveProperty}>
            <input type="hidden" name="id" value={property.id} />
            <ConfirmButton
              message={`Remove ${property.name}? It will disappear from daily screens and public listings, but you can restore it later.`}
              className="btn-secondary btn-sm text-rose-700"
            >
              Remove property
            </ConfirmButton>
          </form>
        </div>
      </details>
      </>}

      {tab === "rooms" && byRoom && (
        <RoomsPanel property={property} rooms={rooms} candidates={roomCandidates} />
      )}

      {tab === "activity" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Leases</span>
              <Link href="/leases/new" className="text-sm text-brand-600 hover:underline">+ New lease</Link>
            </div>
            {leases.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500">No leases for this property.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leases.map((lease) => (
                  <li key={lease.id} className="px-4 py-3 text-sm">
                    <Link href={`/leases/${lease.id}`} className="flex items-center justify-between gap-3 hover:text-brand-600">
                      <div>
                        <div className="font-medium">{lease.tenant_names ?? "No tenants"}</div>
                        <div className="text-xs text-ink-500">{shortDate(lease.start_date)} → {shortDate(lease.end_date)} · {money(lease.rent)}/mo</div>
                      </div>
                      <Badge value={lease.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Repairs</span>
              <Link href="/maintenance/new" className="text-sm text-brand-600 hover:underline">+ New request</Link>
            </div>
            {maintenance.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-500">No repair history.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {maintenance.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div><div className="font-medium">{request.title}</div><div className="text-xs text-ink-500">{shortDate(request.created)}</div></div>
                    <Badge value={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
