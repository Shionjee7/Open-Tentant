# Research: How TurboTenant works, and how OpenTenant replicates it

This document records the research behind OpenTenant's design — what TurboTenant actually does
under the hood, what it charges, and how each piece can be delivered open source.

## 1. Tenant screening / background checks (the $55 question)

**How TurboTenant does it.** TurboTenant does not produce credit or background reports itself.
It partners with **TransUnion** (the SmartMove screening product). The flow:

1. The landlord enters the applicant's email/phone in TurboTenant.
2. The applicant gets a message asking them to verify their identity and answer security questions.
3. The applicant enters their SSN and payment **directly with TransUnion** — the landlord (and
   TurboTenant) never see the SSN.
4. TransUnion returns a report to the landlord: **credit check, criminal background, and eviction
   history** (plus employment history context).

**Who pays the $55.** The **applicant** always pays the screening fee when applying: **$55** on
TurboTenant's free plan, **$45** if the landlord has the Pro/Premium plan. The landlord pays
nothing — screening is actually a revenue source for TurboTenant (they mark up the bureau fee).

**Why it works this way (the legal part).** Consumer credit/criminal/eviction reports are governed
by the **Fair Credit Reporting Act (FCRA)**. Only a consumer reporting agency (CRA) can issue them,
the subject must authorize, and users of the reports take on obligations (permissible purpose,
adverse-action notices, disposal rules). This is why *no* open-source software can "do background
checks" natively — TurboTenant can't either; it brokers to TransUnion.

**The open-source replication.** Do exactly what TurboTenant does, minus the middleman:

- Landlords use **TransUnion SmartMove** (mysmartmove.com) directly — the very same bureau product.
  The landlord sends an invite; the applicant pays ~$43–55 and authorizes; reports come back to the
  landlord. Free for the landlord, no subscription.
- Interchangeable alternatives with the same applicant-pays model: RentPrep, E-Renter, RentSpree.
- OpenTenant's role (same as TurboTenant's UI layer): track screening status
  (not requested → requested → completed), store the report **link** and a summary note, show the
  income-to-rent ratio (3× rule), and record the approve/deny decision.
- Deliberately **not** stored: SSNs, dates of birth, or full report contents — storing consumer
  report data would create FCRA/data-security obligations a self-hosted tool shouldn't impose on
  its users.
- If a landlord denies based on a report, they must send an **adverse-action notice** — surfaced in
  the in-app Resources guide.

## 2. Rent payments

**How TurboTenant does it.** Online rent collection through their payment processor: tenants pay by
ACH, credit, or debit card. Renters pay a **3.49% card fee** on every plan; ACH costs the tenant
**$2** on the free plan (waived on Premium). Payouts to landlords are standard ACH (expedited on
paid plans).

**The open-source replication.** OpenTenant deliberately avoids being a money transmitter:

- The landlord configures **any payment method** in Settings — Zelle, Venmo, ACH details, a Stripe
  payment link, cash, check — and instructions appear in every tenant's portal (0% added fees).
- Rent is **scheduled** (up to 24 months ahead), so upcoming/past-due status is computed
  automatically.
- Tenants report payments from their portal ("I paid this" + method + date + confirmation number);
  the landlord **approves or rejects**; approval marks it paid and auto-books an income transaction.
- Roadmap: optional Stripe integration for true in-app card/ACH, where the landlord brings their own
  Stripe account and keeps the processor relationship.

## 3. Feature map: TurboTenant → OpenTenant

| TurboTenant feature | Tier there | OpenTenant equivalent |
|---|---|---|
| Rental advertising / listings | Free | Public `/listings` page (syndication feeds on roadmap) |
| **Priority listing placement** | Paid | ★ Featured pin on listings — included |
| Online applications | Free (applicant fee) | `/apply/[property]` — free, no applicant fee |
| **Custom application questions** | Paid | Included (Settings → questions) |
| Screening (TransUnion) | $45–55 applicant fee | SmartMove direct + tracking — landlord pays $0 |
| **Income verification** | Premium | Manual verification flag + automatic 3×-rent check |
| Lease agreements & e-sign | Paid (unlimited on Pro) | Lease records + Documenso/DocuSeal/OpenSign |
| Rent collection | Free (fees on payments) | Any rail, fee-free, with approval workflow |
| Rent reminders / late fees | Free | Scheduled payments + late-fee charges (email reminders on roadmap) |
| Maintenance tracking | Free | Full workflow incl. tenant-portal submission |
| Condition reports | Free | 12-area move-in/move-out checklists |
| Accounting / expense tracking | Paid (REI Hub upsell) | Built-in transactions, categories, insights chart |
| Tenant portal | Free | Per-tenant magic link portal |
| Landlord forms library | Paid | Roadmap (state-specific forms need legal review) |
| Rent reporting to bureaus | Paid | Roadmap |

## 4. Pricing context (why this project exists)

- TurboTenant Pro: **$119/yr**; Premium: **$149/yr** (2025 pricing).
- Plus per-transaction revenue: applicant screening fees, card fees, ACH fees on the free tier.
- OpenTenant: **$0**, self-hosted, MIT-licensed. The only money that moves is between tenant,
  landlord, and (optionally) the screening bureau or payment processor the landlord chooses.

## Sources

- [TurboTenant — Tenant Screening Services](https://www.turbotenant.com/tenant-screening/)
- [TurboTenant Help — How Much is the Screening Fee?](https://support.turbotenant.com/en/articles/4004056-how-much-is-the-screening-fee)
- [TurboTenant — Tenant Screening & Application Processing](https://www.turbotenant.com/rental-screening/tenant-screening-application-processing/)
- [TurboTenant — What is a Tenant Screening Report?](https://www.turbotenant.com/glossary/what-is-a-tenant-screening-report/)
- [Haseeb Legal — TurboTenant Background Checks: What Renters Should Know](https://haseeblegal.com/turbo-tenant-background-checks-everything-you-need-to-know/)
- [TurboTenant — Pricing](https://www.turbotenant.com/pricing/)
- [TurboTenant Help — What's Included in the Premium Subscription](https://support.turbotenant.com/en/articles/6046107-what-is-included-in-the-premium-subscription)
- [TurboTenant — Collect Rent Online](https://www.turbotenant.com/collect-rent-payments-online/)
- [TurboTenant — ACH Rent Payments](https://www.turbotenant.com/rent-collection/ach-rent-payment/)
- [TurboTenant — Pricing and Payment Management](https://www.turbotenant.com/property-management/pricing-payment-management/)
- [TransUnion SmartMove](https://www.mysmartmove.com)
