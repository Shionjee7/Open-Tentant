"use client";

import { addRooms, assignRoomTenant, autosaveUnit, deleteUnit } from "@/lib/actions";
import AutosaveStatus from "@/components/AutosaveStatus";
import ConfirmButton from "@/components/ConfirmButton";
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
    <form ref={formRef} {...formEvents} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="id" value={room.id} />
      <input type="hidden" name="property_id" value={propertyId} />

      <div className="sm:col-span-3">
        <label htmlFor={fieldId("name")} className="label">Room name</label>
        <input id={fieldId("name")} name="name" defaultValue={room.name} className="input" />
      </div>
      <div>
        <label htmlFor={fieldId("rent")} className="label">Monthly rent</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">$</span>
          <input id={fieldId("rent")} name="rent" type="number" min="0" step="1" defaultValue={room.rent} className="input pl-7" />
        </div>
      </div>
      <div>
        <label htmlFor={fieldId("deposit")} className="label">Deposit</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">$</span>
          <input id={fieldId("deposit")} name="deposit" type="number" min="0" step="1" defaultValue={room.deposit} className="input pl-7" />
        </div>
      </div>
      <div>
        <label htmlFor={fieldId("size")} className="label">Square feet</label>
        <input id={fieldId("size")} name="size_sqft" type="number" min="0" step="1" defaultValue={room.size_sqft} className="input" />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:col-span-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="private_bath" defaultChecked={!!room.private_bath} className="h-4 w-4 rounded border-slate-300" />
          Private bathroom
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="furnished" defaultChecked={!!room.furnished} className="h-4 w-4 rounded border-slate-300" />
          Furnished
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="listed" defaultChecked={!!room.listed} className="h-4 w-4 rounded border-slate-300" />
          Advertise when vacant
        </label>
      </div>

      <div className="sm:col-span-6">
        <label htmlFor={fieldId("description")} className="label">Notes</label>
        <textarea
          id={fieldId("description")}
          name="description"
          defaultValue={room.description}
          className="input min-h-20 resize-y"
          placeholder="Optional room or listing notes"
        />
      </div>

      <div className="flex min-h-6 items-center justify-end sm:col-span-6">
        <AutosaveStatus state={state} retry={() => void saveNow()} />
      </div>
    </form>
  );
}

function TenantAssignment({
  propertyId,
  room,
  candidates,
}: {
  propertyId: string;
  room: Unit;
  candidates: Person[];
}) {
  const currentTenant = candidates.find(
    (candidate) => candidate.unit === room.id && candidate.stage === "tenant"
  );

  return (
    <form action={assignRoomTenant} className="min-w-0 flex-1 sm:max-w-sm">
      <input type="hidden" name="unit_id" value={room.id} />
      <input type="hidden" name="property_id" value={propertyId} />
      <label htmlFor={`room-${room.id}-tenant`} className="label">Tenant</label>
      <select
        id={`room-${room.id}-tenant`}
        name="person_id"
        defaultValue={currentTenant?.id ?? ""}
        className="input"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="">Vacant - no tenant</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.first_name} {candidate.last_name}
            {candidate.unit && candidate.unit !== room.id
              ? ` - ${candidate.unit_name || "another room"}`
              : candidate.stage === "applicant"
                ? " - applicant"
                : ""}
          </option>
        ))}
      </select>
    </form>
  );
}

function RoomRow({
  property,
  room,
  candidates,
}: {
  property: Property;
  room: Unit;
  candidates: Person[];
}) {
  const details = [
    room.size_sqft > 0 ? `${room.size_sqft.toLocaleString()} sq ft` : "",
    room.private_bath ? "Private bath" : "",
    room.furnished ? "Furnished" : "",
    room.listed ? "Advertised when vacant" : "",
  ].filter(Boolean);
  const inUse = room.status === "occupied" || !!room.tenant_names;

  return (
    <li className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{room.name}</h3>
            <Badge value={room.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {room.tenant_names || "No tenant assigned"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-ink-900">{money(room.rent)}</div>
          <div className="text-xs text-ink-500">per month</div>
        </div>
      </div>

      {details.length > 0 && (
        <p className="mt-2 text-xs text-ink-500">{details.join(" · ")}</p>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <TenantAssignment propertyId={property.id} room={room} candidates={candidates} />
      </div>

      <details className="mt-4 border-t border-slate-100 pt-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-brand-700 hover:text-brand-800">
          Edit room details
        </summary>
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <RoomEditor propertyId={property.id} room={room} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <span className="text-xs text-ink-500">
              {inUse ? "Move the tenant out before deleting this room." : "Deleting a room cannot be undone."}
            </span>
            <form action={deleteUnit}>
              <input type="hidden" name="id" value={room.id} />
              <input type="hidden" name="property_id" value={property.id} />
              <ConfirmButton
                message={`Delete ${room.name}? This cannot be undone.`}
                className="btn-secondary btn-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={inUse}
                title={inUse ? "Move the tenant out before deleting this room" : "Delete this room"}
              >
                Delete room
              </ConfirmButton>
            </form>
          </div>
        </div>
      </details>
    </li>
  );
}

/** Room-by-room rent, occupancy, and listing management. */
export default function RoomsPanel({
  property,
  rooms,
  candidates,
}: {
  property: Property;
  rooms: Unit[];
  candidates: Person[];
}) {
  const occupied = rooms.filter((room) => room.status === "occupied").length;
  const monthlyTotal = rooms.reduce(
    (sum, room) => sum + (room.status === "occupied" ? room.rent : 0),
    0
  );
  const potentialTotal = rooms.reduce((sum, room) => sum + room.rent, 0);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Rooms</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {occupied} of {rooms.length} occupied
          </p>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-ink-500">Occupied rent</dt>
            <dd className="font-semibold text-ink-900">{money(monthlyTotal)}/mo</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">At full occupancy</dt>
            <dd className="font-semibold text-ink-900">{money(potentialTotal)}/mo</dd>
          </div>
        </dl>
      </div>

      {rooms.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-500">No rooms yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rooms.map((room) => (
            <RoomRow key={room.id} property={property} room={room} candidates={candidates} />
          ))}
        </ul>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
        <h3 className="font-semibold text-ink-900">Add more rooms</h3>
        <form action={addRooms} className="mt-3 grid items-end gap-3 sm:grid-cols-[120px_160px_160px_auto]">
          <input type="hidden" name="property_id" value={property.id} />
          <div>
            <label className="label">Number</label>
            <input name="count" type="number" min="1" max="20" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Monthly rent</label>
            <input name="rent" type="number" min="0" step="1" className="input" placeholder="$750" />
          </div>
          <div>
            <label className="label">Deposit</label>
            <input name="deposit" type="number" min="0" step="1" className="input" placeholder="$750" />
          </div>
          <button className="btn">Add rooms</button>
        </form>
      </div>
    </section>
  );
}
