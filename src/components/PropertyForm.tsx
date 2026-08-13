"use client";

import { useRouter } from "next/navigation";
import type { Property } from "@/lib/types";
import { autosaveProperty } from "@/lib/actions";
import { useAutosaveForm } from "@/lib/useAutosaveForm";
import AutosaveStatus from "@/components/AutosaveStatus";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RentalTypeFields from "@/components/RentalTypeFields";

const TYPES = [
  ["single_family", "Single family"],
  ["apartment", "Apartment"],
  ["duplex", "Duplex / multi-unit"],
  ["condo", "Condo"],
  ["townhouse", "Townhouse"],
  ["other", "Other"],
];

export default function PropertyForm({ property }: { property?: Property }) {
  const router = useRouter();
  const { formRef, id, state, saveNow, queueSave, formEvents } = useAutosaveForm({
    action: autosaveProperty,
    initialId: property?.id,
    onCreated: (createdId) => {
      // Preserve the editor in place, but make refresh/back recovery point at
      // the newly created record instead of another blank form.
      const next = `/properties/${createdId}/edit`;
      window.history.replaceState({ ...window.history.state }, "", next);
    },
  });
  const p = property;

  async function finish() {
    const propertyId = await saveNow(true);
    if (propertyId) router.push(`/properties/${propertyId}`);
  }

  return (
    <form
      ref={formRef}
      {...formEvents}
      className="max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      {id && <input type="hidden" name="id" value={id} />}
      {!p && <input type="hidden" name="setup_rooms" value="1" />}

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 sm:px-6">
        <span className="text-sm font-semibold text-ink-900">Property details</span>
        <AutosaveStatus state={state} retry={() => void saveNow(true)} />
      </div>

      <section className="space-y-4 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-ink-900">Name and address</h2>
          <p className="mt-0.5 text-sm text-ink-500">The information you use to recognize this home.</p>
        </div>
        <div>
          <label className="label" htmlFor="property-name">Property name</label>
          <input
            id="property-name"
            name="name"
            defaultValue={p?.name === "Untitled property" ? "" : p?.name}
            className="input"
            placeholder="Maple Street House"
            autoFocus={!p}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AddressAutocomplete
            defaultValue={p?.address}
            defaultCity={p?.city}
            defaultState={p?.state}
            defaultZip={p?.zip}
            onFieldsChange={queueSave}
          />
        </div>
      </section>

      <section className="border-t border-slate-200 px-5 py-5 sm:px-6">
        <div className="mb-4">
          <h2 className="font-semibold text-ink-900">Rent setup</h2>
          <p className="mt-0.5 text-sm text-ink-500">Choose one household or separate room rentals.</p>
        </div>
        <RentalTypeFields
          defaultType={p?.rental_type ?? "whole"}
          defaultRent={p?.rent}
          defaultDeposit={p?.deposit}
          existingRooms={p?.room_count ?? 0}
        />
      </section>

      <details className="group border-t border-slate-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6">
          <span>
            <span className="block text-sm font-semibold text-ink-900">Home details</span>
            <span className="block text-xs text-ink-500">Type, bedrooms, bathrooms, and size</span>
          </span>
          <span className="text-ink-500 transition group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="grid gap-4 border-t border-slate-100 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div>
            <label className="label" htmlFor="property-type">Property type</label>
            <select id="property-type" name="type" defaultValue={p?.type ?? "single_family"} className="input">
              {TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {p && (
            <div>
              <label className="label" htmlFor="property-status">Occupancy</label>
              <select id="property-status" name="status" defaultValue={p.status} className="input">
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div>
              <label className="label" htmlFor="property-beds">Beds</label>
              <input id="property-beds" name="beds" type="number" step="1" min="0" defaultValue={p?.beds || ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="property-baths">Baths</label>
              <input id="property-baths" name="baths" type="number" step="0.5" min="0" defaultValue={p?.baths || ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="property-sqft">Sq ft</label>
              <input id="property-sqft" name="sqft" type="number" step="1" min="0" defaultValue={p?.sqft || ""} className="input" />
            </div>
          </div>
        </div>
      </details>

      <details className="group border-t border-slate-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6">
          <span>
            <span className="block text-sm font-semibold text-ink-900">Public listing</span>
            <span className="block text-xs text-ink-500">Description, amenities, and publishing</span>
          </span>
          <span className="text-ink-500 transition group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <label className="label" htmlFor="property-description">Description</label>
            <textarea id="property-description" name="description" rows={3} defaultValue={p?.description} className="input" placeholder="What makes this rental a good place to live?" />
          </div>
          <div>
            <label className="label" htmlFor="property-amenities">Amenities</label>
            <input id="property-amenities" name="amenities" defaultValue={p?.amenities} className="input" placeholder="Washer/dryer, garage, pet friendly" />
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="listed" defaultChecked={!!p?.listed} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block font-medium">Show on public listings</span>
                <span className="block text-xs text-ink-500">People can view it and open its application.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="priority_listing" defaultChecked={!!p?.priority_listing} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="block font-medium">Pin to the top</span>
                <span className="block text-xs text-ink-500">Use when this vacancy needs extra attention.</span>
              </span>
            </label>
          </div>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <AutosaveStatus state={state} retry={() => void saveNow(true)} />
        <button type="button" onClick={finish} className="btn">
          Done <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
