import Link from "next/link";
import { notFound } from "next/navigation";
import { getProperty, listLeases, listMaintenance, listPeople, listUnits } from "@/lib/data";
import { updateProperty } from "@/lib/actions";
import { money, shortDate, titleCase } from "@/lib/format";
import { Badge, BackLink, PageHeader } from "@/components/ui";
import PropertyForm from "@/components/PropertyForm";
import RoomsPanel from "@/components/RoomsPanel";

export const metadata = { title: "Property" };

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const leases = (await listLeases()).filter((l) => l.property === property.id);
  const maintenance = (await listMaintenance()).filter((m) => m.property === property.id);
  const tenants = (await listPeople("tenant")).filter((p) => p.property === property.id);
  const byRoom = property.rental_type === "by_room";
  const rooms = byRoom ? await listUnits(property.id) : [];
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
            {!!property.listed && (
              <Link href={`/apply/${property.id}`} target="_blank" className="btn-secondary btn-sm">
                Public application ↗
              </Link>
            )}
          </div>
        }
      />

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

      {byRoom && (
        <div className="mb-6">
          <RoomsPanel property={property} rooms={rooms} candidates={roomCandidates} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Edit property</h2>
          <PropertyForm action={updateProperty} property={property} submitLabel="Save changes" />
        </div>

        <div className="space-y-6">
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
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Leases</span>
              <Link href="/leases/new" className="text-sm text-brand-600 hover:underline">+ New lease</Link>
            </div>
            {leases.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-500">No leases for this property.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leases.map((l) => (
                  <li key={l.id} className="px-4 py-3 text-sm">
                    <Link href={`/leases/${l.id}`} className="flex items-center justify-between hover:text-brand-600">
                      <div>
                        <div className="font-medium">{shortDate(l.start_date)} → {shortDate(l.end_date)}</div>
                        <div className="text-xs text-ink-500">{l.tenant_names ?? "No tenants"} · {money(l.rent)}/mo</div>
                      </div>
                      <Badge value={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Maintenance</span>
              <Link href="/maintenance/new" className="text-sm text-brand-600 hover:underline">+ New request</Link>
            </div>
            {maintenance.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-500">No maintenance history.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {maintenance.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-ink-500">{shortDate(m.created)}</div>
                    </div>
                    <Badge value={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
