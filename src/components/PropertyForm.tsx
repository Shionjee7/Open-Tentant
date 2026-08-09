import type { Property } from "@/lib/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RentalTypeFields from "@/components/RentalTypeFields";

const TYPES = [
  ["single_family", "Single family"],
  ["apartment", "Apartment"],
  ["duplex", "Duplex / Multi-unit"],
  ["condo", "Condo"],
  ["townhouse", "Townhouse"],
  ["other", "Other"],
];

export default function PropertyForm({
  action,
  property,
  submitLabel,
}: {
  action: (form: FormData) => Promise<void>;
  property?: Property;
  submitLabel: string;
}) {
  const p = property;
  return (
    <form action={action} className="card max-w-3xl space-y-5 p-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Property name</label>
          <input name="name" required defaultValue={p?.name} className="input" placeholder="Maple Street House" />
        </div>

        <AddressAutocomplete
          defaultValue={p?.address}
          defaultCity={p?.city}
          defaultState={p?.state}
          defaultZip={p?.zip}
        />

        <div>
          <label className="label">Type</label>
          <select name="type" defaultValue={p?.type ?? "single_family"} className="input">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        {p && (
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={p.status} className="input">
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
            </select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 sm:col-span-2">
          <div>
            <label className="label">Beds</label>
            <input name="beds" type="number" step="1" min="0" defaultValue={p?.beds ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Baths</label>
            <input name="baths" type="number" step="0.5" min="0" defaultValue={p?.baths ?? 0} className="input" />
          </div>
          <div>
            <label className="label">Sq ft</label>
            <input name="sqft" type="number" step="1" min="0" defaultValue={p?.sqft ?? 0} className="input" />
          </div>
        </div>
      </div>

      <RentalTypeFields
        defaultType={p?.rental_type ?? "whole"}
        defaultRent={p?.rent}
        defaultDeposit={p?.deposit}
        existingRooms={p?.room_count ?? 0}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Listing description</label>
          <textarea name="description" rows={3} defaultValue={p?.description} className="input" placeholder="Shown on your public listing page." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Amenities (comma separated)</label>
          <input name="amenities" defaultValue={p?.amenities} className="input" placeholder="Washer/Dryer, Garage, Pet Friendly" />
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="listed" defaultChecked={!!p?.listed} className="h-4 w-4 rounded border-slate-300" />
          Publish on the public listings page (marketing site + application link)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="priority_listing" defaultChecked={!!p?.priority_listing} className="h-4 w-4 rounded border-slate-300" />
          Priority listing — pinned to the top of the listings page
        </label>
      </div>

      <button className="btn">{submitLabel}</button>
    </form>
  );
}
