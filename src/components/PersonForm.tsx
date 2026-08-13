"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { autosavePerson } from "@/lib/actions";
import type { Person, Property, Unit } from "@/lib/types";
import { useAutosaveForm } from "@/lib/useAutosaveForm";
import AutosaveStatus from "@/components/AutosaveStatus";

const STAGES = [
  ["tenant", "Current tenant"],
  ["applicant", "Applicant"],
  ["lead", "Lead"],
  ["past", "Past tenant"],
];

export default function PersonForm({
  person,
  properties,
  units,
  defaultStage = "tenant",
}: {
  person?: Person;
  properties: Property[];
  units: Unit[];
  defaultStage?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(person?.stage ?? defaultStage);
  const [propertyId, setPropertyId] = useState(person?.property ?? "");
  const [unitId, setUnitId] = useState(person?.unit ?? "");
  const { formRef, id, state, saveNow, queueSave, formEvents } = useAutosaveForm({
    action: autosavePerson,
    initialId: person?.id,
    onCreated: (createdId) => {
      window.history.replaceState(
        { ...window.history.state },
        "",
        `/contacts/${createdId}/edit`
      );
    },
  });

  const property = properties.find((item) => item.id === propertyId);
  const rooms = units.filter((unit) => unit.property === propertyId);
  const showRoom = property?.rental_type === "by_room";
  const stageOptions = person?.stage === "tenant" ? STAGES.filter(([value]) => value === "tenant") : STAGES;

  async function finish() {
    const personId = await saveNow(true);
    if (personId) router.push(`/contacts?stage=${stage}`);
  }

  return (
    <form
      ref={formRef}
      {...formEvents}
      className="max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      {id && <input type="hidden" name="id" value={id} />}

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 sm:px-6">
        <span className="text-sm font-semibold text-ink-900">Contact details</span>
        <AutosaveStatus state={state} retry={() => void saveNow(true)} />
      </div>

      <section className="space-y-4 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-ink-900">Who is this?</h2>
          <p className="mt-0.5 text-sm text-ink-500">Name and the best way to reach them.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="person-first-name">First name</label>
            <input
              id="person-first-name"
              name="first_name"
              defaultValue={person?.first_name === "New" && person?.last_name === "contact" ? "" : person?.first_name}
              className="input"
              autoFocus={!person}
            />
          </div>
          <div>
            <label className="label" htmlFor="person-last-name">Last name</label>
            <input
              id="person-last-name"
              name="last_name"
              defaultValue={person?.first_name === "New" && person?.last_name === "contact" ? "" : person?.last_name}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="person-email">Email</label>
            <input id="person-email" name="email" type="email" defaultValue={person?.email} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="person-phone">Phone</label>
            <input id="person-phone" name="phone" type="tel" defaultValue={person?.phone} className="input" />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-semibold text-ink-900">Rental</h2>
          <p className="mt-0.5 text-sm text-ink-500">Their current place in your rental workflow.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="person-stage">Status</label>
            <select
              id="person-stage"
              name="stage"
              value={stage}
              onChange={(event) => {
                setStage(event.target.value);
                queueSave();
              }}
              className="input"
            >
              {stageOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="person-property">Property</label>
            <select
              id="person-property"
              name="property_id"
              value={propertyId}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setUnitId("");
                queueSave();
              }}
              className="input"
            >
              <option value="">Not assigned</option>
              {properties.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          {showRoom ? (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="person-room">Room</label>
              <select
                id="person-room"
                name="unit_id"
                value={unitId}
                onChange={(event) => {
                  setUnitId(event.target.value);
                  queueSave();
                }}
                className="input"
              >
                <option value="">Not assigned</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · ${room.rent}/mo
                    {room.status === "occupied" && room.id !== person?.unit ? " · occupied" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="unit_id" value="" />
          )}
        </div>
      </section>

      <details className="group border-t border-slate-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 sm:px-6">
          <span>
            <span className="block text-sm font-semibold text-ink-900">Notes</span>
            <span className="block text-xs text-ink-500">Anything useful to remember</span>
          </span>
          <span className="text-ink-500 transition group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
          <label className="sr-only" htmlFor="person-notes">Notes</label>
          <textarea id="person-notes" name="notes" rows={4} defaultValue={person?.notes} className="input" />
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
