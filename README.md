# OpenTenant 🏠

**Free, open-source property management for landlords — a self-hosted alternative to TurboTenant.**

Every feature unlocked. No $119–149/year "Pro" plan, no per-payment fees, no lock-in.
Your data lives in a single SQLite file on your own machine.

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Occupancy, active tenants & leases, collected this month/year, past due, open maintenance, expiring leases |
| **Properties** | Full property records with rent, deposit, amenities, and listing controls |
| **Public listings** | A marketing page (`/listings`) with online applications — ★ Priority/Featured pinning included (a paid feature elsewhere) |
| **Leads & Tenants** | Pipeline from lead → applicant → tenant → past tenant, with one-click stage moves |
| **Applications** | Online rental applications with **custom screening questions**, income vs 3×-rent check, and **income verification** (paid features elsewhere) |
| **Tenant screening** | Track credit/criminal/eviction screening through TransUnion SmartMove or any FCRA agency — applicant pays the bureau, you pay nothing (see [docs/RESEARCH.md](docs/RESEARCH.md)) |
| **Leases** | Draft → sent → signed → active → ended, with tenants attached and e-sign links |
| **Payments** | Schedule rent up to 24 months ahead, record any payment method (Zelle, ACH, card, cash, check), automatic past-due tracking |
| **Tenant portal** | Private per-tenant link: balance due, **"I paid this"** reporting (you approve), payment history, maintenance requests |
| **Maintenance** | Requests with priority and status workflow, from tenants or you |
| **Documents & E-Sign** | Track documents through signing via open-source tools ([Documenso](https://documenso.com), [DocuSeal](https://www.docuseal.com), [OpenSign](https://www.opensignlabs.com)) |
| **Condition reports** | 12-area move-in/move-out checklists that lock when completed |
| **Accounting & Insights** | Approved payments auto-book as income; expenses by category; income-vs-expense chart; net profit |
| **Resources** | Built-in guides, including how the paid platforms actually work under the hood |

## Quick start

Requires **Node.js ≥ 22.13** (the database uses Node's built-in SQLite — zero native dependencies).

```bash
git clone https://github.com/shionjee7/open-tentant.git
cd open-tentant
npm install
npm run dev
```

Open http://localhost:3000 — click **Load demo data** to explore every module with sample
records, or add your first property and start clean. The database is created automatically at
`data/opentenant.db` (gitignored — back this file up and you've backed up everything).

For production: `npm run build && npm start`, put it behind any reverse proxy, and restrict access
to the app routes (the `/listings`, `/apply/*`, and `/portal/*` routes are the only ones meant to
be public — see Roadmap for built-in auth).

## How the "paid" features work here

- **Background checks** — no software can lawfully invent a credit/criminal/eviction report; they
  must come from a consumer reporting agency (FCRA). TurboTenant resells TransUnion reports and the
  *applicant* pays $45–55. You can use the same bureau directly via
  [TransUnion SmartMove](https://www.mysmartmove.com): send an invite, the applicant pays ~$43–55
  and authorizes, you get the report — OpenTenant tracks status, report link, and your decision.
  Full research with sources: [docs/RESEARCH.md](docs/RESEARCH.md).
- **Rent payments** — instead of a built-in processor charging 3.49% card / $2 ACH fees, you
  configure whatever rails you already use (Zelle, Venmo, ACH, a Stripe payment link, cash, check).
  Tenants report payments from their portal; you approve; income books itself into Accounting.
- **E-signatures** — pair with a self-hosted open-source signing tool (Documenso, DocuSeal,
  OpenSign) and track signing status on each document.

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, Server Components + Server Actions)
- [Tailwind CSS 4](https://tailwindcss.com)
- SQLite via Node's built-in `node:sqlite` — no ORM, no native builds, transparent SQL
- TypeScript

## Roadmap

- [ ] Multi-user auth (landlord accounts, tenant logins beyond magic links)
- [ ] Email notifications (rent reminders, application received, maintenance updates)
- [ ] Stripe/PayPal integration for true in-app card & ACH payments
- [ ] Direct e-sign API integration (Documenso/DocuSeal APIs) instead of pasted links
- [ ] File uploads (lease PDFs, maintenance photos, condition-report photos)
- [ ] Listing syndication feeds (Zillow/Zumper formats)
- [ ] Rent reporting to credit bureaus
- [ ] Multi-unit buildings (units as first-class records)
- [ ] Postgres option for larger portfolios

Contributions welcome — this project exists so no landlord has to pay rent on their own software.

## License

[MIT](LICENSE)
