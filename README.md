# OpenTenant 🏠

**Free, open-source property management for landlords.**

Listings, applications, screening, leases, rent collection, maintenance, and accounting —
self-hosted, with no subscription and no cut taken from rent. Your data lives in a single
file on your own machine.

![Dashboard](docs/screenshots/dashboard.png)

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Occupancy, active tenants & leases, collected this month/year, past due, open maintenance, expiring leases |
| **Properties** | Full property records with rent, deposit, amenities, and listing controls — plus **address autocomplete** that fills city, state, and ZIP |
| **Rent by the room** | Rent a house room by room: each room has its own rent, deposit, tenant, lease, and listing |
| **Public listings** | A marketing page (`/listings`) with online applications; vacant rooms list individually, and featured properties pin to the top |
| **Leads & Tenants** | Pipeline from lead → applicant → tenant → past tenant, with one-click stage moves |
| **Applications** | Online applications with **custom questions**, an automatic income-to-rent check, and income verification |
| **Tenant screening** | Track credit/criminal/eviction screening through any FCRA bureau — the applicant pays, you pay nothing ([how it works](docs/HOW-IT-WORKS.md)) |
| **Leases** | Draft → sent → signed → active → ended, with tenants attached and e-sign links |
| **Payments** | Schedule rent up to 24 months ahead, accept any method (Zelle, ACH, card, cash, check), automatic past-due tracking |
| **Banking & Deposits** | Record which account each property's rent lands in, **import bank/Zelle/Cash App statements**, and assign each deposit to the tenant who paid — auto-suggested by amount, name, and due date |
| **Tenant portal** | Private per-tenant link: balance due, **"I paid this"** reporting (you approve), payment history, maintenance requests |
| **Maintenance** | Requests with priority and status workflow, from tenants or you |
| **Documents & E-Sign** | Track documents through signing via open-source tools ([Documenso](https://documenso.com), [DocuSeal](https://www.docuseal.com), [OpenSign](https://www.opensignlabs.com)) |
| **Condition reports** | 12-area move-in/move-out checklists that lock when completed |
| **Accounting & Insights** | Approved payments auto-book as income; expenses by category; income-vs-expense chart; net profit |
| **Resources** | Built-in guides for screening, rent collection, room rentals, and reconciliation |

## Screenshots

| | |
|---|---|
| **Banking & Deposits** — import a statement, and each deposit is matched to the tenant who paid ![Banking](docs/screenshots/banking.png) | **Rent by the room** — each room has its own rent, tenant, and listing ![Rooms](docs/screenshots/rooms.png) |
| **Payments** — tenant-reported payments queue for one-click approval ![Payments](docs/screenshots/payments.png) | **Tenant portal** — balance due, "I paid this", history, maintenance ![Tenant portal](docs/screenshots/portal.png) |
| **Accounting** — income vs expenses, categories, net profit ![Accounting](docs/screenshots/accounting.png) | **Public listings** — whole homes and single rooms, apply online ![Listings](docs/screenshots/listings.png) |
| **Application review** — income check, verification, screening ![Application detail](docs/screenshots/application-detail.png) | **Condition reports** — move-in/move-out checklists ![Condition report](docs/screenshots/condition-report.png) |

## Quick start

Requires **Node.js ≥ 22.13** (the database uses Node's built-in SQLite — no native builds).

```bash
git clone https://github.com/Shionjee7/Open-Tentant.git
cd Open-Tentant
npm run setup
```

That installs, builds, and starts the app. Open http://localhost:3000 and click **Load demo
data** to explore every module with sample records, or add your first property and start
clean.

For day-to-day development use `npm run dev` instead. The database is created automatically
at `data/opentenant.db` — back up that file and you've backed up everything.

## Deploy it (get a real URL)

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for Render (one-click blueprint included), Railway,
Fly.io, and plain Docker. Two things matter wherever you host it:

- **Set `ADMIN_PASSWORD`** — this turns on the login gate for your dashboard. Without it the
  app runs open, which is fine on your laptop and *not* fine on a public URL.
- **Mount a persistent volume and point `DATA_DIR` at it** (e.g. `DATA_DIR=/var/data`) so
  your data survives restarts.

With Docker on any server you own:

```bash
ADMIN_PASSWORD="a-long-random-password" docker compose up -d
```

### Who can reach what

| Route | Access |
|---|---|
| `/`, `/properties`, `/payments`, `/banking`, … | You — password required |
| `/listings`, `/apply/[id]` | Public, by design (prospects browse and apply) |
| `/portal/[token]` | The tenant holding that unguessable link |

## Configuration

Every setting is optional — the app runs with none of them.

| Variable | What it does |
|---|---|
| `ADMIN_PASSWORD` | Enables the login gate. Required for any public deployment. |
| `DATA_DIR` | Where the SQLite file lives. Point at your mounted volume. |
| `PORT` | Port to listen on (default 3000). |
| `GEOCODER_URL` | Your own Nominatim/Photon instance for address autocomplete. |
| `GEOCODER_CONTACT` | Contact string sent with geocoding requests. |

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, Server Components + Server Actions)
- [Tailwind CSS 4](https://tailwindcss.com)
- SQLite via Node's built-in `node:sqlite` — no ORM, no native builds, transparent SQL
- TypeScript

Everything it depends on is free and open source. Schema changes migrate automatically on
startup, so upgrading is `git pull` with no manual steps.

## Roadmap

- [ ] Multi-user auth (multiple landlord accounts; today it's a single shared password)
- [ ] Email notifications (rent reminders, application received, maintenance updates)
- [ ] Optional Stripe integration for in-app card & ACH payments
- [ ] Direct e-sign API integration instead of pasted links
- [ ] File uploads (lease PDFs, maintenance photos, condition-report photos)
- [ ] Native PDF statement parsing (today: paste the text, or import CSV)
- [ ] Listing syndication feeds
- [ ] Rent reporting to credit bureaus
- [ ] Postgres option for larger portfolios

Contributions welcome — this project exists so no landlord has to pay rent on their own
software.

## License

[MIT](LICENSE)
