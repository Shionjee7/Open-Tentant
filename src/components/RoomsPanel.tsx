"use client";

import { addRooms, assignRoomTenant, autosaveUnit, deleteUnit } from "@/lib/actions";
import AutosaveStatus from "@/components/AutosaveStatus";
import { money } from "@/lib/format";
import { useAutosaveForm } from "@/lib/useAutosaveForm";
import { Badge } from "@/components/ui";
import type { Person, Property, Unit } from "@/lib/types";

function RoomEditor({ propertyId, room }: { propertyId: string; room: Unit }) {
  const { formRef, state, saveNow, formEvents } = useAutosaveForm({
    action: autosaveUnit,
    initialId: room.id,
  });
  const fieldId = (name: string) => `room-${room.id}-${name}`;

  return (
    <form ref={formRef} {...formEvents} className="grid items-end gap-3 sm:grid-cols-12">
      <input type="hidden" name="id" value={room.id} />
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="sm:col-span-4">
        <label htmlFor={fieldId("name")} className="label">Room name</label>
        <input id={fieldId("name")} name="name" defaultValue={room.name} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={fieldId("rent")} className="label">Rent ($)</label>
        <input id={fieldId("rent")} name="rent" type="number" min="0" step="1" defaultValue={room.rent} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={fieldId("deposit")} className="label">Deposit ($)</label>
        <input id={fieldId("deposit")} name="deposit" type="number" min="0" step="1" defaultValue={room.deposit} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={fieldId("size")} className="label">Sq ft</label>
        <input id={fieldId("size")} name="size_sqft" type="number" min="0" step="1" defaultValue={room.size_sqft} className="input" />
      </div>
      <div className="flex flex-col items-start gap-1 sm:col-span-2">
        <Badge value={room.status} />
        <AutosaveStatus state={state} retry={() => void saveNow()} />
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-12">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="private_bath" defaultChecked={!!room.private_bath} className="h-4 w-4 rounded border-slate-300" />
          Private bathroom
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="furnished" defaultChecked={!!room.furnished} className="h-4 w-4 rounded border-slate-300" />
          Furnished
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="listed" defaultChecked={!!room.listed} className="h-4 w-4 rounded border-slate-300" />
          Advertise when vacant
        </label>
        <input
          name="description"
          aria-label={`${room.name} listing notes`}
          defaultValue={room.description}
          className="input h-8 min-w-40 flex-1 py-1 text-xs"
          placeholder="Notes for the listing (optional)"
        />
      </div>
    </form>
  );
}

/**
 * Room-by-room management for a property: rent, deposit, who lives there,
 * and whether the room is advertised.
 */
export default function RoomsPanel({
  property,
  rooms,
  candidates,
}: {
  property: Property;
  rooms: Unit[];
  candidates: Person[];
}) {
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const monthlyTotal = rooms.reduce((sum, r) => sum + (r.status === "occupied" ? r.rent : 0), 0);
  const potentialTotal = rooms.reduce((sum, r) => sum + r.rent, 0);

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Rooms</h2>
          <p className="text-xs text-ink-500">
            {rooms.length} room{rooms.length === 1 ? "" : "s"} · {occupied} occupied ·{" "}
            {money(monthlyTotal)}/mo collected of {money(potentialTotal)} potential
          </p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-500">
          No rooms yet. Add them below — each gets its own rent, tenant, and listing.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rooms.map((room) => (
            <li key={room.id} className="px-5 py-4">
              <RoomEditor propertyId={property.id} room={room} />

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                <form action={assignRoomTenant} className="flex items-center gap-2">
                  <input type="hidden" name="unit_id" value={room.id} />
                  <input type="hidden" name="property_id" value={property.id} />
                  <label className="text-xs font-medium text-ink-500">Tenant</label>
                  <select name="person_id" defaultValue="" className="input h-8 w-52 py-1 text-xs">
                    <option value="">
                      {room.tenant_names ? `${room.tenant_names} (change…)` : "— nobody assigned —"}
                    </option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.stage})
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary btn-sm">Assign</button>
                </form>
                {room.tenant_names && (
                  <span className="text-xs text-ink-700">
                    Currently: <strong>{room.tenant_names}</strong>
                  </span>
                )}
                <form action={deleteUnit} className="ml-auto">
                  <input type="hidden" name="id" value={room.id} />
                  <input type="hidden" name="property_id" value={property.id} />
                  <button className="btn-secondary btn-sm" title="Delete this room">Delete</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={addRooms} className="flex flex-wrap items-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        <input type="hidden" name="property_id" value={property.id} />
        <div>
          <label className="label">Add rooms</label>
          <input name="count" type="number" min="1" max="20" defaultValue="1" className="input w-24" />
        </div>
        <div>
          <label className="label">Rent each ($)</label>
          <input name="rent" type="number" min="0" step="1" className="input w-32" placeholder="750" />
        </div>
        <div>
          <label className="label">Deposit each ($)</label>
          <input name="deposit" type="number" min="0" step="1" className="input w-32" placeholder="750" />
        </div>
        <button className="btn">Add</button>
      </form>
    </section>
  );
}
