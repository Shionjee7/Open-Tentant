import Link from "next/link";
import {
  countPeopleByStage,
  listLeases,
  listPayments,
  listPeople,
} from "@/lib/data";
import {
  archivePerson,
  moveOutTenant,
  restorePerson,
  sendPortalInvite,
  setPersonStage,
} from "@/lib/actions";
import { money, shortDate } from "@/lib/format";
import { Badge, EmptyState, HubLinks, PageHeader } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const metadata = { title: "Tenants" };

const TABS = [
  { key: "tenant", label: "Current tenants" },
  { key: "applicant", label: "Applicants" },
  { key: "lead", label: "Leads" },
  { key: "past", label: "Past tenants" },
  { key: "removed", label: "Removed" },
];

const NEXT_STAGE: Record<string, { stage: string; label: string }> = {
  lead: { stage: "applicant", label: "Move to applicants" },
  applicant: { stage: "tenant", label: "Make current tenant" },
  past: { stage: "tenant", label: "Restore as current tenant" },
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    view?: string;
    moved?: string;
    mail?: string;
    removed?: string;
    restored?: string;
  }>;
}) {
  const params = await searchParams;
  const removedView = params.view === "removed";
  const stage = TABS.some((tab) => tab.key === params.stage && tab.key !== "removed")
    ? params.stage!
    : "tenant";
  const [allPeople, counts, payments, leases] = await Promise.all([
    removedView ? listPeople(undefined, true) : listPeople(stage),
    countPeopleByStage(),
    listPayments(),
    listLeases(),
  ]);
  const people = removedView ? allPeople.filter((person) => person.archived) : allPeople;
  const removedCount = (await listPeople(undefined, true)).filter((person) => person.archived).length;
  const currentMonth = new Date().toISOString().slice(0, 7);

  function rentFor(personId: string) {
    const leaseIds = new Set(
      leases.filter((lease) => lease.tenants.includes(personId)).map((lease) => lease.id)
    );
    const rows = payments.filter(
      (payment) =>
        payment.type === "rent" &&
        payment.due_date.startsWith(currentMonth) &&
        (payment.person === personId || (payment.lease && leaseIds.has(payment.lease)))
    );
    if (rows.length === 0) return null;
    const paid = rows.filter((row) => row.status === "paid");
    return {
      state: paid.length === rows.length ? "paid" : rows.some((row) => row.status === "reported") ? "reported" : "unpaid",
      paid: paid.reduce((total, row) => total + row.amount, 0),
      due: rows.reduce((total, row) => total + row.amount, 0),
    };
  }

  const notice = params.moved
    ? "Tenant moved out. Their room is available and their history is preserved."
    : params.removed
      ? "Contact removed. Their lease and payment history is still available."
      : params.restored
        ? "Contact restored as a past tenant."
        : params.mail === "sent"
          ? "Portal link emailed."
          : params.mail === "failed"
            ? "Couldn’t send the email. Check Email in Settings."
            : params.mail === "noaddress"
              ? "Add an email address before sending a portal link."
              : "";

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="People, where they live, and whether this month’s rent is in."
        action={<Link href="/contacts/new?stage=tenant" className="btn">+ Add tenant</Link>}
      />

      <HubLinks
        links={[
          { href: "/applications", label: "Applications", detail: "People applying to rent from you" },
          { href: "/leases", label: "Leases", detail: "Write, send, and sign a lease" },
          { href: "/documents", label: "Documents", detail: "Leases and notices, and their signing status" },
          { href: "/condition-reports", label: "Condition reports", detail: "Move-in and move-out walkthroughs" },
          { href: "/signing-app", label: "Signing app", detail: "Sign anything that isn't a lease" },
        ]}
      />

      {notice && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <nav className="mb-5 flex flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1 text-sm font-medium sm:flex-nowrap sm:overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.key === "removed" ? removedView : !removedView && stage === tab.key;
          const count = tab.key === "removed" ? removedCount : counts[tab.key] ?? 0;
          return (
            <Link
              key={tab.key}
              href={tab.key === "removed" ? "/contacts?view=removed" : `/contacts?stage=${tab.key}`}
              className={`shrink-0 flex-auto rounded-md px-3 py-2 text-center transition sm:flex-none ${
                active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {tab.label} <span className="text-ink-500">({count})</span>
            </Link>
          );
        })}
      </nav>

      {people.length === 0 ? (
        <EmptyState
          title={removedView ? "No removed contacts" : `No ${TABS.find((tab) => tab.key === stage)?.label.toLowerCase()}`}
          message={removedView ? "Contacts you remove can be restored here." : "Add someone and assign their property or room."}
          action={!removedView ? <Link href={`/contacts/new?stage=${stage}`} className="btn">+ Add person</Link> : undefined}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
          {people.map((person) => {
            const name = `${person.first_name} ${person.last_name}`.trim();
            const rent = person.stage === "tenant" ? rentFor(person.id) : null;
            const next = NEXT_STAGE[person.stage];
            return (
              <li key={person.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {(person.first_name[0] || "?").toUpperCase()}{(person.last_name[0] || "").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/contacts/${person.id}/edit`} className="font-semibold text-ink-900 hover:text-brand-600">
                      {name}
                    </Link>
                    <div className="truncate text-sm text-ink-500">
                      {person.email || person.phone || "No contact details"}
                    </div>
                  </div>
                </div>

                <div className="min-w-40 sm:text-right">
                  <div className="text-sm font-medium text-ink-900">{person.property_name ?? "No property"}</div>
                  <div className="text-xs text-ink-500">{person.unit_name ?? (person.property_name ? "Whole property" : "Not assigned")}</div>
                </div>

                {!removedView && person.stage === "tenant" && (
                  <div className="min-w-36 sm:text-right">
                    {rent ? (
                      <>
                        <Badge
                          value={rent.state}
                          label={rent.state === "paid" ? "Paid this month" : rent.state === "reported" ? "Reported paid" : "Rent due"}
                        />
                        <div className="mt-1 text-xs text-ink-500">
                          {money(rent.paid)} of {money(rent.due)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-500">No rent scheduled</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {removedView ? (
                    <form action={restorePerson}>
                      <input type="hidden" name="id" value={person.id} />
                      <button className="btn-secondary btn-sm">Restore</button>
                    </form>
                  ) : (
                    <>
                      <Link href={`/contacts/${person.id}/edit`} className="btn-secondary btn-sm">Edit</Link>
                      {person.stage === "tenant" && person.portal_token && (
                        <Link href={`/portal/${person.portal_token}`} target="_blank" className="btn-secondary btn-sm">
                          Portal ↗
                        </Link>
                      )}
                      <details className="relative">
                        <summary className="btn-secondary btn-sm cursor-pointer list-none">More</summary>
                        <div className="absolute right-0 z-20 mt-1 w-56 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                          {person.stage === "tenant" && person.email && (
                            <form action={sendPortalInvite}>
                              <input type="hidden" name="id" value={person.id} />
                              <button className="w-full text-left text-sm hover:text-brand-600">Email portal link</button>
                            </form>
                          )}
                          {person.stage === "tenant" && (
                            <form action={moveOutTenant}>
                              <input type="hidden" name="id" value={person.id} />
                              <ConfirmButton
                                message={`Move ${name} out? Their lease will end only if nobody else remains on it.`}
                                className="w-full text-left text-sm hover:text-brand-600"
                              >
                                Move out
                              </ConfirmButton>
                            </form>
                          )}
                          {next && (
                            <form action={setPersonStage}>
                              <input type="hidden" name="id" value={person.id} />
                              <input type="hidden" name="stage" value={next.stage} />
                              <button className="w-full text-left text-sm hover:text-brand-600">{next.label}</button>
                            </form>
                          )}
                          <form action={archivePerson} className="border-t border-slate-100 pt-2">
                            <input type="hidden" name="id" value={person.id} />
                            <ConfirmButton
                              message={`Remove ${name}? Their history will stay intact and you can restore them later.`}
                              className="w-full text-left text-sm text-rose-700 hover:text-rose-800"
                            >
                              Remove contact
                            </ConfirmButton>
                          </form>
                        </div>
                      </details>
                    </>
                  )}
                </div>

                {person.notes && (
                  <div className="text-xs text-ink-500 sm:hidden">Added {shortDate(person.created)} · {person.notes}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
