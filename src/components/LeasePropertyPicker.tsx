"use client";

import { useState } from "react";
import type { Property, Unit } from "@/lib/types";

/**
 * Property picker that reveals a room selector when the chosen property is
 * rented by the room, and prefills rent and deposit from whatever is selected.
 */
export default function LeasePropertyPicker({
  properties,
  units,
}: {
  properties: Property[];
  units: Unit[];
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? 0);
  const [unitId, setUnitId] = useState(0);

  const property = properties.find((p) => p.id === propertyId);
  const byRoom = property?.rental_type === "by_room";
  const rooms = units.filter((u) => u.property_id === propertyId);
  const room = rooms.find((u) => u.id === unitId);

  const rent = byRoom ? (room?.rent ?? 0) : (property?.rent ?? 0);
  const deposit = byRoom ? (room?.deposit ?? 0) : (property?.deposit ?? 0);

  return (
    <>
      <div>
        <label className="label">Property</label>
        <select
          name="property_id"
          required
          className="input"
          value={propertyId}
          onChange={(e) => {
            setPropertyId(Number(e.target.value));
            setUnitId(0);
          }}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.rental_type === "by_room" ? " (by the room)" : ""}
            </option>
          ))}
        </select>
      </div>

      {byRoom ? (
        <div>
          <label className="label">Room</label>
          <select
            name="unit_id"
            required
            className="input"
            value={unitId}
            onChange={(e) => setUnitId(Number(e.target.value))}
          >
            <option value={0} disabled>Choose a room…</option>
            {rooms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — ${u.rent}/mo {u.status === "occupied" ? "(occupied)" : ""}
              </option>
            ))}
          </select>
          {rooms.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              This property has no rooms yet — add them on the property page first.
            </p>
          )}
        </div>
      ) : (
        <input type="hidden" name="unit_id" value="" />
      )}

      <div>
        <label className="label">Monthly rent ($)</label>
        {/* Keyed so picking a different property or room reloads the suggested
            amount, while still letting you type your own. */}
        <input
          key={`rent-${propertyId}-${unitId}`}
          name="rent"
          type="number"
          min="0"
          step="1"
          required
          className="input"
          defaultValue={rent || ""}
        />
      </div>
      <div>
        <label className="label">Security deposit ($)</label>
        <input
          key={`dep-${propertyId}-${unitId}`}
          name="deposit"
          type="number"
          min="0"
          step="1"
          className="input"
          defaultValue={deposit || ""}
        />
      </div>
    </>
  );
}
