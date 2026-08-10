import Link from "next/link";
import { listProperties } from "@/lib/data";
import { money, titleCase } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const properties = await listProperties();
  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} propert${properties.length === 1 ? "y" : "ies"} in your portfolio`}
        action={<Link href="/properties/new" className="btn">+ Add property</Link>}
      />
      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          message="Add your first rental to start managing listings, leases, and payments."
          action={<Link href="/properties/new" className="btn">+ Add property</Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/properties/${p.id}`} className="card block p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-ink-900">{p.name}</div>
                <Badge value={p.status} />
              </div>
              <div className="mt-1 text-sm text-ink-500">
                {p.address}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""}
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-ink-700">
                <span>{p.beds} bd</span>·<span>{p.baths} ba</span>·<span>{p.sqft.toLocaleString()} sqft</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {p.rental_type === "by_room" ? (
                  <span className="text-lg font-bold text-ink-900">
                    {(p.room_count ?? 0) - (p.rooms_vacant ?? 0)}/{p.room_count ?? 0}
                    <span className="text-xs font-normal text-ink-500"> rooms filled</span>
                  </span>
                ) : (
                  <span className="text-lg font-bold text-ink-900">
                    {money(p.rent)}<span className="text-xs font-normal text-ink-500">/mo</span>
                  </span>
                )}
                <div className="flex gap-1.5">
                  {!!p.listed && <Badge value="active" label="Listed" />}
                  {!!p.priority_listing && <Badge value="screening" label="★ Priority" />}
                </div>
              </div>
              <div className="mt-2 text-xs text-ink-500">
                {titleCase(p.type)}
                {p.rental_type === "by_room" && " · rented by the room"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
