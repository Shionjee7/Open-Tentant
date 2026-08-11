import Link from "next/link";
import {
  countPeopleByStage,
  listAllUnits,
  listLeases,
  listPayments,
  listPeople,
  listProperties,
  getSetting,
} from "@/lib/data";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Start here" };

/**
 * The plain-language walkthrough for someone who just opened the app.
 *
 * Every step reports whether it's done and links straight to the one screen
 * that finishes it, so a first-time landlord is never asked to interpret a
 * full dashboard.
 */
export default async function StartPage() {
  const [properties, units, people, leases, payments, businessName, smtpHost] = await Promise.all([
    listProperties(),
    listAllUnits(),
    listPeople(),
    listLeases(),
    listPayments(),
    getSetting("business_name"),
    getSetting("smtp_host"),
  ]);

  const stages = await countPeopleByStage();
  const byRoomProperties = properties.filter((p) => p.rental_type === "by_room");
  const tenantsWithPortal = people.filter((p) => p.stage === "tenant" && p.portal_token);
  const scheduledRent = payments.filter((p) => p.type === "rent");

  const steps = [
    {
      done: Boolean(businessName),
      title: "Tell the app who you are",
      body: "Your business name and address appear on leases, receipts, and your public listings page.",
      href: "/settings",
      cta: "Open settings",
      detail: businessName ? `Set to “${businessName}”` : undefined,
    },
    {
      done: properties.length > 0,
      title: "Add your first property",
      body: "Choose whether you rent the whole place to one household, or room by room. If it's by the room, say how many rooms and the app creates them for you.",
      href: "/properties/new",
      cta: "Add a property",
      detail:
        properties.length > 0
          ? `${properties.length} propert${properties.length === 1 ? "y" : "ies"}` +
            (byRoomProperties.length ? ` · ${units.length} rooms` : "")
          : undefined,
    },
    {
      done: people.length > 0,
      title: "Add your tenant",
      body: "Add whoever lives there under Leads & Tenants, with their email so the app can reach them. For a by-the-room property, assign them to a room on the property page.",
      href: "/contacts?stage=tenant",
      cta: "Add a tenant",
      detail: people.length > 0 ? `${stages.tenant ?? 0} tenants · ${stages.lead ?? 0} leads` : undefined,
    },
    {
      done: leases.length > 0,
      title: "Create the lease",
      body: "The app writes a full lease from what you entered — rent, deposit, term, fees — ready to print or send for signature. You can also just record the lease you already have.",
      href: "/leases/new",
      cta: "Create a lease",
      detail: leases.length > 0 ? `${leases.length} lease${leases.length === 1 ? "" : "s"}` : undefined,
    },
    {
      done: scheduledRent.length > 0,
      title: "Schedule the rent",
      body: "Set the monthly rent once and repeat it for 12 months. After that, what's due and what's late keeps itself up to date.",
      href: "/payments/new",
      cta: "Schedule rent",
      detail: scheduledRent.length > 0 ? `${scheduledRent.length} rent charges scheduled` : undefined,
    },
    {
      done: tenantsWithPortal.length > 0 && Boolean(smtpHost),
      title: "Give your tenant their portal",
      body: "Each tenant gets a private link showing what they owe, where they can tap “I paid this”. You approve it, and it books itself. Email them the link from Leads & Tenants.",
      href: "/contacts?stage=tenant",
      cta: "Send portal links",
      detail: smtpHost ? undefined : "Connect your email in Settings first, so links can be sent",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader
        title="Start here"
        subtitle="Six steps to a running rental. Do them in order — each one takes a minute."
      />

      <div className="mb-6 card px-5 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {doneCount} of {steps.length} done
          </span>
          <span className="text-ink-500">
            {doneCount === steps.length ? "You're all set 🎉" : "Pick up where you left off"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className={`card flex flex-wrap items-start gap-4 px-5 py-4 ${step.done ? "opacity-75" : ""}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.done ? "bg-emerald-100 text-emerald-700" : "bg-brand-600 text-white"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink-900">{step.title}</div>
              <p className="mt-0.5 text-sm text-ink-700">{step.body}</p>
              {step.detail && <p className="mt-1 text-xs text-ink-500">{step.detail}</p>}
            </div>
            <Link href={step.href} className={step.done ? "btn-secondary btn-sm" : "btn"}>
              {step.done ? "Review" : step.cta}
            </Link>
          </li>
        ))}
      </ol>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Then, every month</h2>
        <ul className="mt-2 space-y-2 text-sm text-ink-700">
          <li>
            <strong>Tenant pays.</strong> They tap “I paid this” in their portal, or you mark it paid
            yourself on the <Link href="/payments" className="text-brand-600 hover:underline">Payments</Link> page.
          </li>
          <li>
            <strong>Upload your bank statement.</strong> Export the CSV from your bank and drop it into{" "}
            <Link href="/banking" className="text-brand-600 hover:underline">Banking</Link>. The app matches each
            deposit to the tenant who paid, and skips anything you already recorded so nothing counts twice.
          </li>
          <li>
            <strong>Send receipts.</strong> One button on the Payments page emails every tenant a receipt for
            what they paid that month.
          </li>
          <li>
            <strong>Check the numbers.</strong>{" "}
            <Link href="/accounting" className="text-brand-600 hover:underline">Accounting</Link> shows income,
            expenses, what's in the bank, and what the next few years look like if things stay as they are.
          </li>
        </ul>
      </section>
    </>
  );
}
