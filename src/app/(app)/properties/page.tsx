import Link from "next/link";
import { listProperties } from "@/lib/data";
import { restoreProperty } from "@/lib/actions";
import { money, titleCase } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; removed?: string; restored?: string }>;
}) {
  const params = await searchParams;
  const all = await listProperties(true);
  const removed = all.filter((property) => property.archived);
  const active = all.filter((property) => !property.archived);
  const removedView = params.view === "removed";
  const properties = removedView ? removed : active;

  return (
    <>
      <PageHeader
        title={removedView ? "Removed properties" : "Properties"}
        subtitle={
          removedView
            ? "Restore a property without losing its leases or financial history."
            : `${active.length} propert${active.length === 1 ? "y" : "ies"} in your portfolio`
        }
        action={
          <div className="flex items-center gap-2">
            {removedView ? (
              <Link href="/properties" className="btn-secondary">Back to properties</Link>
            ) : (
              <>
                {removed.length > 0 && (
                  <Link href="/properties?view=removed" className="btn-secondary">
                    Removed ({removed.length})
                  </Link>
                )}
                <Link href="/properties/new" className="btn">+ Add property</Link>
              </>
            )}
          </div>
        }
      />

      {(params.removed || params.restored) && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.removed ? "Property removed. Its history is preserved." : "Property restored."}
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState
          title={removedView ? "No removed properties" : "No properties yet"}
          message={
            removedView
              ? "Properties you remove can be restored here."
              : "Add your first rental to start managing rooms, tenants, rent, and expenses."
          }
          action={!removedView ? <Link href="/properties/new" className="btn">+ Add property</Link> : undefined}
        />
      ) : removedView ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
          {properties.map((property) => (
            <li key={property.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="font-semibold text-ink-900">{property.name}</div>
                <div className="text-sm text-ink-500">
                  {[property.address, property.city, property.state].filter(Boolean).join(", ") || "No address"}
                </div>
              </div>
              <form action={restoreProperty}>
                <input type="hidden" name="id" value={property.id} />
                <button className="btn-secondary btn-sm">Restore</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`} className="card block p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-ink-900">{property.name}</div>
                <Badge value={property.status} />
              </div>
              <div className="mt-1 text-sm text-ink-500">
                {[property.address, property.city, property.state].filter(Boolean).join(", ") || "No address yet"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-700">
                {property.beds > 0 && <span>{property.beds} bd</span>}
                {property.baths > 0 && <span>· {property.baths} ba</span>}
                {property.sqft > 0 && <span>· {property.sqft.toLocaleString()} sqft</span>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {property.rental_type === "by_room" ? (
                  <span className="text-lg font-bold text-ink-900">
                    {(property.room_count ?? 0) - (property.rooms_vacant ?? 0)}/{property.room_count ?? 0}
                    <span className="text-xs font-normal text-ink-500"> rooms filled</span>
                  </span>
                ) : (
                  <span className="text-lg font-bold text-ink-900">
                    {money(property.rent)}<span className="text-xs font-normal text-ink-500">/mo</span>
                  </span>
                )}
                {!!property.listed && <Badge value="active" label="Listed" />}
              </div>
              <div className="mt-2 text-xs text-ink-500">
                {titleCase(property.type)}
                {property.rental_type === "by_room" && " · rented by the room"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
