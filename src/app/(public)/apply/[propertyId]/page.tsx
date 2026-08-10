import { notFound } from "next/navigation";
import { getProperty, getUnit, listQuestions, listUnits } from "@/lib/data";
import { submitApplication } from "@/lib/actions";
import { money } from "@/lib/format";

export const metadata = { title: "Rental application" };

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { propertyId } = await params;
  const { room } = await searchParams;
  const property = await getProperty(propertyId);
  if (!property) notFound();
  const questions = await listQuestions();

  const byRoom = property.rental_type === "by_room";
  const requestedRoom = room ? await getUnit(room) : undefined;
  // Only honor a room that really belongs to this property.
  const unit = requestedRoom?.property === property.id ? requestedRoom : undefined;
  const availableRooms = byRoom
    ? (await listUnits(property.id)).filter((u) => u.status === "vacant" && u.listed)
    : [];

  const rent = unit ? unit.rent : property.rent;
  const deposit = unit ? unit.deposit : property.deposit;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Apply for {unit ? `${unit.name} at ${property.name}` : property.name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {property.address}{property.city ? `, ${property.city}` : ""} · {money(rent)}/mo ·
          deposit {money(deposit)}
        </p>
      </div>

      <form action={submitApplication} className="card space-y-5 p-6">
        <input type="hidden" name="property_id" value={property.id} />
        {unit && <input type="hidden" name="unit_id" value={unit.id} />}

        {byRoom && !unit && (
          <div>
            <label className="label">Which room?</label>
            {availableRooms.length === 0 ? (
              <p className="text-sm text-ink-500">
                No rooms are available right now — you can still apply and we&apos;ll be in touch.
              </p>
            ) : (
              <select name="unit_id" required className="input" defaultValue="">
                <option value="" disabled>Choose a room…</option>
                {availableRooms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {money(u.rent)}/mo
                    {u.private_bath ? " · private bath" : ""}
                    {u.furnished ? " · furnished" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">First name</label>
            <input name="first_name" required className="input" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input name="last_name" required className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Desired move-in date</label>
            <input name="move_in_date" type="date" className="input" />
          </div>
          <div>
            <label className="label">Monthly income ($)</label>
            <input name="monthly_income" type="number" min="0" step="1" required className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Current employer</label>
            <input name="employer" className="input" />
          </div>
        </div>

        {questions.length > 0 && (
          <div className="space-y-4 rounded-lg bg-slate-50 p-4">
            <h2 className="text-sm font-semibold">A few more questions</h2>
            {questions.map((q) => (
              <div key={q.id}>
                <label className="label">
                  {q.question} {!!q.required && <span className="text-rose-500">*</span>}
                </label>
                {q.type === "yesno" ? (
                  <select name={`q_${q.id}`} required={!!q.required} className="input" defaultValue="">
                    <option value="" disabled>Select…</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <input
                    name={`q_${q.id}`}
                    type={q.type === "number" ? "number" : "text"}
                    required={!!q.required}
                    className="input"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-ink-500">
          By submitting, you confirm the information is accurate. If screening is required, you&apos;ll
          receive a separate invitation from a consumer reporting agency (e.g. TransUnion SmartMove) —
          your SSN is never collected by this site.
        </p>
        <button className="btn w-full justify-center">Submit application</button>
      </form>
    </div>
  );
}
