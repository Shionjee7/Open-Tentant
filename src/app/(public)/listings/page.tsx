import Link from "next/link";
import { listedProperties } from "@/lib/data";
import { money, titleCase } from "@/lib/format";

export const metadata = { title: "Available rentals" };

export default function ListingsPage() {
  const listings = listedProperties();
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Available rentals</h1>
        <p className="mt-1 text-sm text-ink-500">Apply online in a few minutes — no account needed.</p>
      </div>
      {listings.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-ink-500">
          No listings available right now. Check back soon!
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {listings.map((p) => (
            <div key={p.id} className={`card overflow-hidden ${p.priority_listing ? "ring-2 ring-brand-500/60" : ""}`}>
              <div className="flex h-36 items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 text-5xl">
                🏠
              </div>
              <div className="p-5">
                {!!p.priority_listing && (
                  <span className="mb-2 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    ★ Featured
                  </span>
                )}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-ink-900">{p.name}</h2>
                  <div className="text-lg font-bold">{money(p.rent)}<span className="text-xs font-normal text-ink-500">/mo</span></div>
                </div>
                <div className="mt-0.5 text-sm text-ink-500">
                  {p.city}{p.state ? `, ${p.state}` : ""} · {titleCase(p.type)}
                </div>
                <div className="mt-2 text-sm text-ink-700">
                  {p.beds} bd · {p.baths} ba · {p.sqft.toLocaleString()} sqft
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-sm text-ink-500">{p.description}</p>}
                {p.amenities && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.amenities.split(",").slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-700">
                        {a.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <Link href={`/apply/${p.id}`} className="btn mt-4 w-full justify-center">
                  Apply now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
