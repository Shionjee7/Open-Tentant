import { PageHeader } from "@/components/ui";

export const metadata = { title: "Resources" };

const GUIDES: { title: string; body: React.ReactNode }[] = [
  {
    title: "1 · The rental workflow, end to end",
    body: (
      <>
        <p>
          OpenTenant follows the full landlord workflow: <strong>Property → Listing → Leads →
          Application → Screening → Lease → Payments → Maintenance → Accounting</strong>.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Add a property and tick <em>Publish on the public listings page</em>.</li>
          <li>Share <code>/listings</code> — prospects browse and apply online (your custom questions included).</li>
          <li>Applications arrive under <em>Applications</em>; verify income, run screening, approve or deny.</li>
          <li>Approving moves the applicant to <em>Tenants</em>. Create a lease, send it for e-signature, activate it.</li>
          <li>Schedule 12 months of rent in <em>Payments</em>. Share the tenant&apos;s portal link from <em>Leads &amp; Tenants</em>.</li>
          <li>Tenants report payments and maintenance from their portal; you approve with one click.</li>
        </ol>
      </>
    ),
  },
  {
    title: "2 · Renting a house out by the room",
    body: (
      <>
        <p>
          Set a property&apos;s type to <em>By the room</em> and OpenTenant treats each room as its own
          rental: its own rent, deposit, tenant, lease, and listing.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Say how many rooms when you create the property — they&apos;re generated for you, rename any time.</li>
          <li>Each room tracks size, private vs shared bath, and furnished status. Vacant rooms appear individually on your public listings page.</li>
          <li>Applicants apply to a specific room, and the income check compares against <em>that room&apos;s</em> rent.</li>
          <li>Approving an application fills the room and assigns the tenant automatically.</li>
          <li>The property page shows rooms filled and total rent roll versus potential.</li>
        </ul>
      </>
    ),
  },
  {
    title: "3 · Background checks &amp; screening",
    body: (
      <>
        <p>
          Credit, criminal, and eviction reports are governed by the <strong>Fair Credit Reporting
          Act</strong>. Only a consumer reporting agency can issue them, the applicant must consent,
          and no software can generate one on its own — every rental platform brokers to a bureau.
        </p>
        <p className="mt-2">
          You can go straight to a bureau, at no cost to you, because the applicant pays:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <a href="https://www.mysmartmove.com" target="_blank" className="text-brand-600 hover:underline">
              TransUnion SmartMove
            </a> — you send an invite; the applicant pays (~$43–55) and authorizes; you receive
            credit, criminal, and eviction reports. You never see their Social Security number.
          </li>
          <li>
            Alternatives with the same applicant-pays model:{" "}
            <a href="https://www.rentprep.com" target="_blank" className="text-brand-600 hover:underline">RentPrep</a>,{" "}
            <a href="https://www.e-renter.com" target="_blank" className="text-brand-600 hover:underline">E-Renter</a>,{" "}
            <a href="https://www.rentspree.com" target="_blank" className="text-brand-600 hover:underline">RentSpree</a>.
          </li>
          <li>
            Track it here: set screening to <em>Requested</em>, paste the report link when it&apos;s
            back, and record a summary. Full reports stay with the bureau — storing them yourself
            creates legal obligations you don&apos;t want.
          </li>
        </ul>
        <p className="mt-2 text-xs">
          Follow your state&apos;s screening-fee rules, and if you deny someone based on a report, send
          an adverse-action notice — that&apos;s an FCRA requirement.
        </p>
      </>
    ),
  },
  {
    title: "4 · Collecting rent — Zelle, card, cash, anything",
    body: (
      <>
        <p>
          OpenTenant never touches your money and never takes a cut. You collect however you already
          do, and the app keeps the books.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Put your Zelle/Venmo/ACH details or a payment link in <em>Settings → Payment instructions</em> — they appear in every tenant portal.</li>
          <li>Schedule rent months ahead (<em>Payments → Record/schedule → repeat 12 months</em>) so past-due tracking is automatic.</li>
          <li>Tenants hit <em>“I paid this”</em> in their portal with method, date, and confirmation number; you <em>Approve</em>, and the income books itself.</li>
          <li>Cash or check in hand? Use <em>Mark paid</em> directly.</li>
        </ul>
      </>
    ),
  },
  {
    title: "5 · Verifying payments from your bank statement",
    body: (
      <>
        <p>
          <em>Banking &amp; Deposits</em> reconciles what actually hit your account against what tenants owe.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Record which account each property&apos;s rent lands in (nickname and last four digits only — never full account numbers).</li>
          <li>Export CSV from your bank, Zelle, Cash App, Venmo, or PayPal and upload it, or paste lines copied from a PDF statement.</li>
          <li>Each deposit is matched against open payments using the amount, the name in the description, and the due date — the likely tenant is pre-selected.</li>
          <li>Confirm, and the payment is marked paid and booked as income. Non-rent deposits can be booked separately or ignored.</li>
          <li>Re-importing the same statement never creates duplicates.</li>
        </ul>
        <p className="mt-2 text-xs">
          Live bank connections require paid aggregators that bill per account per month, so
          OpenTenant uses statement import instead — same result, no subscription.
        </p>
      </>
    ),
  },
  {
    title: "6 · E-signatures without per-document fees",
    body: (
      <>
        <p>Pair OpenTenant with a self-hosted open-source signing tool:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><a href="https://documenso.com" target="_blank" className="text-brand-600 hover:underline">Documenso</a> — the leading open-source e-signature platform.</li>
          <li><a href="https://www.docuseal.com" target="_blank" className="text-brand-600 hover:underline">DocuSeal</a> — lightweight, easy Docker deploy.</li>
          <li><a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">OpenSign</a> — another solid option.</li>
        </ul>
        <p className="mt-2">
          Set your instance URL in <em>Settings</em>, upload the lease there, and paste the signing
          link on the lease or document record. Track draft → sent → viewed → signed in <em>Documents</em>.
        </p>
      </>
    ),
  },
  {
    title: "7 · Condition reports that protect your deposit decisions",
    body: (
      <p>
        Create a <em>move-in</em> report the day the tenant gets keys: walk each area, set Good/Fair/Poor,
        note existing damage, complete the report (it locks), and print it for signatures. At move-out,
        create a <em>move-out</em> report for the same property and compare — documented differences are
        what hold up in deposit disputes.
      </p>
    ),
  },
  {
    title: "8 · What this costs you",
    body: (
      <div className="overflow-x-auto">
        <p className="mb-2">
          Nothing. Every feature is included — there is no paid tier, and no fee is taken from rent.
          The only money that ever moves is between you, your tenants, and any service you choose
          yourself:
        </p>
        <table className="mt-1 w-full min-w-[460px] text-sm">
          <thead>
            <tr>
              <th className="th">What</th>
              <th className="th">Cost</th>
              <th className="th">Paid by</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["OpenTenant itself", "$0 — open source, self-hosted", "—"],
              ["Rent collection", "$0 — you use your own Zelle/ACH/etc.", "—"],
              ["Tenant screening", "~$43–55 per report, direct to the bureau", "The applicant"],
              ["E-signatures", "$0 self-hosted", "—"],
              ["Hosting (optional)", "$0 on your own machine; a few $/mo on a host", "You"],
            ].map(([a, b, c]) => (
              <tr key={a} className="border-t border-slate-100">
                <td className="td font-medium">{a}</td>
                <td className="td">{b}</td>
                <td className="td">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        title="Resources"
        subtitle="How to run your rentals with OpenTenant — screening, rent collection, room rentals, and reconciliation."
      />
      <div className="max-w-3xl space-y-5">
        {GUIDES.map((g) => (
          <details key={g.title} className="card group p-5" open={g.title.startsWith("1")}>
            <summary className="cursor-pointer font-semibold text-ink-900 marker:text-brand-500">
              {g.title.replace("&amp;", "&")}
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-ink-700">{g.body}</div>
          </details>
        ))}
      </div>
    </>
  );
}
