"use client";

import { useState } from "react";

/**
 * Choose how the property is rented: the whole place to one household, or
 * room by room. Picking "by the room" swaps the single rent field for the
 * room setup, and (on a new property) creates the rooms straight away.
 */
export default function RentalTypeFields({
  defaultType = "whole",
  defaultRent = 0,
  defaultDeposit = 0,
  existingRooms = 0,
}: {
  defaultType?: string;
  defaultRent?: number;
  defaultDeposit?: number;
  existingRooms?: number;
}) {
  const [type, setType] = useState(defaultType === "by_room" ? "by_room" : "whole");

  return (
    <div>
      <div className="label">How is this rented?</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["whole", "The whole place", "One lease for the entire property."],
          ["by_room", "By the room", "Each room rented separately, own tenant and rent."],
        ].map(([value, title, hint]) => (
          <label
            key={value}
            className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition ${
              type === value ? "border-brand-500 bg-brand-50/60" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="rental_type"
              value={value}
              checked={type === value}
              onChange={() => setType(value)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-ink-500">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {type === "whole" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="property-rent">Monthly rent ($)</label>
            <input id="property-rent" name="rent" type="number" step="1" min="0" defaultValue={defaultRent || ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="property-deposit">Security deposit ($)</label>
            <input id="property-deposit" name="deposit" type="number" step="1" min="0" defaultValue={defaultDeposit || ""} className="input" />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {existingRooms > 0 ? (
            <p className="text-sm text-ink-500">
              This property has <strong>{existingRooms} room{existingRooms === 1 ? "" : "s"}</strong>.
              Manage each room&apos;s rent, deposit, and tenant on the property page below.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="property-room-count">How many rooms?</label>
                <input id="property-room-count" name="room_count" type="number" step="1" min="1" max="20" defaultValue="4" className="input" />
                <p className="mt-1 text-xs text-ink-500">Rooms are created for you — rename them any time.</p>
              </div>
              <div>
                <label className="label" htmlFor="property-room-rent">Rent per room ($/mo)</label>
                <input id="property-room-rent" name="room_rent" type="number" step="1" min="0" className="input" placeholder="750" />
                <p className="mt-1 text-xs text-ink-500">Set once now, adjust per room later.</p>
              </div>
              <div>
                <label className="label" htmlFor="property-room-deposit">Deposit per room ($)</label>
                <input id="property-room-deposit" name="room_deposit" type="number" step="1" min="0" className="input" placeholder="750" />
                <p className="mt-1 text-xs text-ink-500">Each room starts with this deposit.</p>
              </div>
            </div>
          )}
          {/* Keep the property-level fields present so the form always submits them. */}
          <input type="hidden" name="rent" value={defaultRent || 0} />
          <input type="hidden" name="deposit" value={defaultDeposit || 0} />
        </div>
      )}
    </div>
  );
}
