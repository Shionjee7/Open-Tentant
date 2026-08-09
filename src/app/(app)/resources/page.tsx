import { PageHeader } from "@/components/ui";

export const metadata = { title: "Resources" };

const GUIDES: { title: string; body: React.ReactNode }[] = [
  {
    title: "1 · The rental workflow, end to end",
    body: (
      <>
        <p>
          OpenTenant mirrors the full landlord workflow: <strong>Property → Listing → Leads →
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
    title: "2 · Background checks & screening (how TurboTenant does it, and how you can too)",
    body: (
      <>
        <p>
          Credit, criminal, and eviction reports legally must come from a <strong>consumer reporting
          agency</strong> (FCRA). TurboTenant doesn&apos;t generate them either — they resell TransUnion
          reports: the applicant pays the ~$55 fee ($45 on paid plans), enters their SSN directly with
          TransUnion, and the landlord gets the report without ever seeing the SSN.
        </p>
        <p className="mt-2">You can do the identical thing for free (to you) without any middleman:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <a href="https://www.mysmartmove.com" target="_blank" className="text-brand-600 hover:underline">
              TransUnion SmartMove
            </a> — the same bureau TurboTenant uses. You send an invite by email; the applicant pays
            (~$43–55) and authorizes; you get credit + criminal + eviction reports. No cost to you.
          </li>
          <li>
            Alternatives with the same applicant-pays model:{" "}
            <a href="https://www.rentprep.com" target="_blank" className="text-brand-600 hover:underline">RentPrep</a>,{" "}
            <a href="https://www.e-renter.com" target="_blank" className="text-brand-600 hover:underline">E-Renter</a>,{" "}
            <a href="https://www.rentspree.com" target="_blank" className="text-brand-600 hover:underline">RentSpree</a>.
          </li>
          <li>
            Track it in OpenTenant: on the application page set screening to <em>Requested</em>, paste
            the report link when it&apos;s back, and record a summary. Full reports stay with the bureau —
            storing them yourself creates FCRA obligations you don&apos;t want.
          </li>
        </ul>
        <p className="mt-2 text-xs">
          Always follow your state&apos;s screening-fee laws and, if you deny based on a report, send an
          adverse-action notice (an FCRA requirement).
        </p>
      </>
    ),
  },
  {
    title: "3 · Collecting rent — Zelle, card, cash, anything",
    body: (
      <>
        <p>
          TurboTenant routes payments through their processor (renters pay a 3.49% card fee; ACH is $2
          on the free plan). OpenTenant takes the opposite approach: <strong>use any payment rail you
          like and keep 100%</strong>.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Put your Zelle/Venmo/ACH details or a Stripe payment link in <em>Settings → Payment instructions</em> — they appear in every tenant portal.</li>
          <li>Schedule rent months ahead (<em>Payments → Record/schedule → repeat 12 months</em>) so past-due tracking is automatic.</li>
          <li>Tenants hit <em>“I paid this”</em> in their portal with method + date + confirmation number; you <em>Approve</em>, and the income books itself into Accounting.</li>
          <li>Cash or check in hand? Use <em>Mark paid</em> directly — same result.</li>
        </ul>
      </>
    ),
  },
  {
    title: "4 · E-signatures without DocuSign fees",
    body: (
      <>
        <p>Pair OpenTenant with a self-hosted open-source signing tool:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><a href="https://documenso.com" target="_blank" className="text-brand-600 hover:underline">Documenso</a> — the leading open-source DocuSign alternative.</li>
          <li><a href="https://www.docuseal.com" target="_blank" className="text-brand-600 hover:underline">DocuSeal</a> — lightweight, easy Docker deploy.</li>
          <li><a href="https://www.opensignlabs.com" target="_blank" className="text-brand-600 hover:underline">OpenSign</a> — another solid option.</li>
        </ul>
        <p className="mt-2">
          Set your instance URL in <em>Settings</em>, upload the lease PDF there, and paste the signing
          link on the lease or document record. Track draft → sent → viewed → signed in <em>Documents</em>.
        </p>
      </>
    ),
  },
  {
    title: "5 · Condition reports that protect your deposit decisions",
    body: (
      <p>
        Create a <em>move-in</em> report the day the tenant gets keys: walk each area, set Good/Fair/Poor,
        note existing damage, complete the report (it locks), and print it for signatures. At move-out,
        create a <em>move-out</em> report for the same property and compare — documented deltas are what
        hold up in deposit disputes.
      </p>
    ),
  },
  {
    title: "6 · Where TurboTenant charges, and what OpenTenant does instead",
    body: (
      <div className="overflow-x-auto">
        <table className="mt-1 w-full min-w-[520px] text-sm">
          <thead>
            <tr>
              <th className="th">Feature</th>
              <th className="th">TurboTenant</th>
              <th className="th">OpenTenant</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Software", "Free + $119–149/yr for Pro/Premium", "Free, open source, self-hosted"],
              ["Screening", "$45–55 (applicant pays, TransUnion)", "Applicant pays bureau directly (~$43–55), you track results"],
              ["Rent payments", "3.49% card fee, $2 ACH (free tier)", "Any rail you choose — Zelle/ACH/cash — 0% added"],
              ["Custom questions", "Pro feature", "Included"],
              ["Priority listing", "Pro feature", "Included (Featured pin on your listings page)"],
              ["Income verification", "Premium feature", "Included (manual verify + 3× rent check)"],
              ["E-sign", "Included, their platform", "Documenso / DocuSeal / OpenSign (self-hosted, free)"],
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
        subtitle="How to run your rentals with OpenTenant — and how the paid platforms actually work under the hood."
      />
      <div className="max-w-3xl space-y-5">
        {GUIDES.map((g) => (
          <details key={g.title} className="card group p-5" open={g.title.startsWith("1")}>
            <summary className="cursor-pointer font-semibold text-ink-900 marker:text-brand-500">
              {g.title}
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-ink-700">{g.body}</div>
          </details>
        ))}
      </div>
    </>
  );
}
