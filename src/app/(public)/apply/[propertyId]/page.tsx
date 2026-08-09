import { notFound } from "next/navigation";
import { getProperty, listQuestions } from "@/lib/data";
import { submitApplication } from "@/lib/actions";
import { money } from "@/lib/format";

export const metadata = { title: "Rental application" };

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const property = getProperty(Number(propertyId));
  if (!property) notFound();
  const questions = listQuestions();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Apply for {property.name}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {property.address}{property.city ? `, ${property.city}` : ""} · {money(property.rent)}/mo ·
          deposit {money(property.deposit)}
        </p>
      </div>

      <form action={submitApplication} className="card space-y-5 p-6">
        <input type="hidden" name="property_id" value={property.id} />
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
