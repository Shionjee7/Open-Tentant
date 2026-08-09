import { notFound } from "next/navigation";
import { getApplication } from "@/lib/data";
import { setApplicationStatus, setScreening, toggleIncomeVerified } from "@/lib/actions";
import { money, shortDate } from "@/lib/format";
import { Badge, BackLink, PageHeader, ProBadge } from "@/components/ui";

export const metadata = { title: "Application" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = getApplication(Number(id));
  if (!app) notFound();

  const answers: { question: string; answer: string }[] = JSON.parse(app.answers || "[]");
  const ratio = app.property_rent ? app.monthly_income / app.property_rent : null;

  return (
    <>
      <BackLink href="/applications" label="Applications" />
      <PageHeader
        title={`Application — ${app.applicant_name}`}
        subtitle={`${app.property_name ?? "No property"} · applied ${shortDate(app.created_at)}`}
        action={<Badge value={app.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Applicant details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-500">Email</dt>
                <dd>{app.applicant_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-500">Desired move-in</dt>
                <dd>{shortDate(app.move_in_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-500">Employer</dt>
                <dd>{app.employer || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-ink-500">Monthly income</dt>
                <dd className="flex items-center gap-2">
                  {money(app.monthly_income)}
                  {ratio !== null && (
                    <span className={`text-xs font-semibold ${ratio >= 3 ? "text-emerald-600" : "text-amber-600"}`}>
                      {ratio.toFixed(1)}× rent {ratio >= 3 ? "(meets 3× rule)" : "(below 3× rule)"}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">Custom question answers <ProBadge /></h2>
            {answers.length === 0 ? (
              <p className="text-sm text-ink-500">No custom questions were configured when this application was submitted.</p>
            ) : (
              <ul className="space-y-3">
                {answers.map((a, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-xs font-semibold uppercase text-ink-500">{a.question}</div>
                    <div className="mt-1">{a.answer || "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Decision</h2>
            <div className="flex gap-2">
              <form action={setApplicationStatus} className="flex-1">
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="status" value="approved" />
                <button className="btn w-full bg-emerald-600 hover:bg-emerald-700">Approve</button>
              </form>
              <form action={setApplicationStatus} className="flex-1">
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="status" value="denied" />
                <button className="btn w-full bg-rose-600 hover:bg-rose-700">Deny</button>
              </form>
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Approving moves the applicant to your Tenants list. Next step: create a lease.
            </p>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">Income verification <ProBadge /></h2>
            <p className="mb-3 text-xs text-ink-500">
              Verify with pay stubs, bank statements, or an employer letter — then mark it here.
            </p>
            <form action={toggleIncomeVerified}>
              <input type="hidden" name="id" value={app.id} />
              <button className={app.income_verified ? "btn-secondary w-full" : "btn w-full"}>
                {app.income_verified ? "✓ Verified — click to undo" : "Mark income verified"}
              </button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-semibold">Tenant screening <ProBadge /></h2>
            <p className="mb-3 text-xs text-ink-500">
              Credit, criminal, and eviction reports must come from a consumer reporting agency —
              that&apos;s how TurboTenant does it too (they resell TransUnion). Invite the applicant
              through{" "}
              <a href="https://www.mysmartmove.com" target="_blank" className="text-brand-600 hover:underline">
                TransUnion SmartMove
              </a>{" "}
              (applicant pays ~$43–55, you pay nothing, you never see their SSN), then track the
              result here. See Resources for details.
            </p>
            <form action={setScreening} className="space-y-3">
              <input type="hidden" name="id" value={app.id} />
              <div>
                <label className="label">Status</label>
                <select name="screening_status" defaultValue={app.screening_status} className="input">
                  <option value="not_requested">Not requested</option>
                  <option value="requested">Requested</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="label">Screening report link</label>
                <input
                  name="screening_link"
                  type="url"
                  defaultValue={app.screening_link}
                  className="input"
                  placeholder="Link to the SmartMove report"
                />
                {app.screening_link && (
                  <a href={app.screening_link} target="_blank" className="mt-1 inline-block text-xs text-brand-600 hover:underline">
                    Open report ↗
                  </a>
                )}
              </div>
              <div>
                <label className="label">Notes / report summary</label>
                <textarea
                  name="screening_notes"
                  rows={3}
                  defaultValue={app.screening_notes}
                  className="input"
                  placeholder="Credit score range, background check result, references…"
                />
              </div>
              <button className="btn w-full">Save screening</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
