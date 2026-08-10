# How OpenTenant works

Background on the parts of renting that involve outside services — screening, rent
collection, e-signatures — and how OpenTenant handles each without charging you.

## 1. Tenant screening and background checks

Credit reports, criminal history, and eviction records are regulated by the **Fair Credit
Reporting Act (FCRA)**. Only a **consumer reporting agency** may issue them, the applicant
must authorize the check, and whoever uses the report takes on legal duties (a permissible
purpose, adverse-action notices, secure disposal).

That means no software — this one included — can produce a background check by itself.
Every rental platform brokers the request to a bureau. The difference is whether a
middleman marks up the fee.

**How OpenTenant handles it.** Go straight to the bureau, so nothing is marked up:

- **[TransUnion SmartMove](https://www.mysmartmove.com)** — you send an invite by email;
  the applicant pays (~$43–55) and consents directly; credit, criminal, and eviction
  reports come back to you. Free for the landlord, no subscription.
- Same applicant-pays model: [RentPrep](https://www.rentprep.com),
  [E-Renter](https://www.e-renter.com), [RentSpree](https://www.rentspree.com).

OpenTenant's job is the workflow around it: screening status (not requested → requested →
completed), the report link, your notes, the income-to-rent ratio, and the approve/deny
decision.

**Deliberately not stored:** Social Security numbers, dates of birth, or report contents.
Holding consumer-report data would place FCRA and data-security obligations on every
self-hosted user, so the app never collects it.

## 2. Rent collection

Most rental platforms route payments through their own processor and take a percentage of
card payments plus a flat fee on bank transfers. OpenTenant is not a payment processor and
never touches your money, so there is nothing to take a cut of.

- Put your Zelle, Venmo, ACH details, or a payment link in **Settings** — they appear in
  every tenant portal.
- Rent is **scheduled** ahead (up to 24 months), so upcoming and past-due status is
  automatic.
- Tenants report payments from their portal ("I paid this" + method + date + confirmation
  number); you **approve or reject**; approval marks it paid and books the income.
- Or reconcile against your bank statement — see below.

## 3. Bank statements and reconciliation

Live bank connections run through aggregators (Plaid and similar) that bill per connected
account per month. Rather than require a paid dependency, OpenTenant imports statements:

- Export CSV from your bank, Zelle, Cash App, Venmo, or PayPal — or paste lines copied out
  of a PDF statement.
- Column layouts differ per bank, so the parser finds whichever columns look like a date, a
  description, and an amount. Payer names and memos are combined, since the name is the
  strongest matching signal.
- Each deposit is scored against open payments on amount, name, and due-date proximity; the
  likely tenant is pre-selected.
- Confirming marks the payment paid and books income. Re-importing the same file never
  duplicates rows.

## 4. E-signatures

Pair with a self-hosted open-source signing tool — [Documenso](https://documenso.com),
[DocuSeal](https://www.docuseal.com), or [OpenSign](https://www.opensignlabs.com). Set your
instance URL in Settings, upload the lease there, and paste the signing link onto the lease
or document record. OpenTenant tracks draft → sent → viewed → signed.

## 5. What anything costs

| What | Cost | Paid by |
|---|---|---|
| OpenTenant | $0 — open source, self-hosted | — |
| Rent collection | $0 — your own payment rails | — |
| Tenant screening | ~$43–55 per report, direct to the bureau | The applicant |
| E-signatures | $0 self-hosted | — |
| Hosting | $0 on your own machine; a few dollars a month on a host | You |

## 6. Email

OpenTenant sends mail through **your own email account** over SMTP — there is no mail service
to subscribe to and no per-message cost. Gmail is the common choice and the app offers it as a
preset.

**Gmail needs an App Password**, not your normal password: turn on 2-Step Verification, then
create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
and paste the 16-character value into Settings. A free Gmail account sends roughly 500 messages
a day, far more than a rental portfolio needs. Outlook, iCloud, Yahoo, and any custom SMTP
server work the same way.

What gets sent automatically:

| Trigger | Who gets it |
|---|---|
| Application submitted | Confirmation to the applicant, alert to you |
| Application approved or denied | The applicant |
| Payment recorded, approved, or matched from a statement | Receipt to the tenant |
| Maintenance request from the portal | Confirmation to the tenant, alert to you |

And on demand: rent reminders (**Remind** on any unpaid payment) and portal invites
(**Email link** next to any tenant).

Sending never blocks the app — if mail fails, the application, payment, or request is still
recorded, and the failure is logged.

## 7. Address autocomplete

Property address fields autocomplete via [OpenStreetMap
Nominatim](https://nominatim.openstreetmap.org) — free, open data, no API key or account.
Requests are proxied through the app so a proper User-Agent is sent, and debounced to
respect the public instance's usage policy. Point `GEOCODER_URL` at your own Nominatim or
Photon instance to avoid the shared service entirely. If the lookup is unreachable, the
field behaves as ordinary text input.
