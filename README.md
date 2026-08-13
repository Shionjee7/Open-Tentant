# OpenTenant 🏠

**Free, open-source property management for landlords.**

Listings, applications, screening, leases, rent collection, maintenance, and accounting —
self-hosted, with no subscription and no cut taken from rent. Your data stays on your own
machine, in a database you control.

![Dashboard](docs/screenshots/dashboard.png)

## A short menu by default

Most weeks a landlord touches five screens, so those are the only ones the menu shows —
**Home, Properties, Tenants, Rent, Repairs** — plus Start here and Settings. The rest
(applications, leases, documents, condition reports, bank deposits, accounting, guides) live
behind **Show all features**, grouped by the moment you'd reach for them. The choice sticks,
and if you follow a link to a screen the short menu hides, it joins the menu while you're on it
so you can never get lost.

## Features

| Module | What it does |
|---|---|
| **Start here** | A six-step guided setup that tells you what's done and what's next, so a first-time landlord never faces a blank dashboard |
| **Home** | Occupancy, active tenants & leases, collected this month/year, past due, open maintenance, expiring leases |
| **Properties** | Full property records with rent, deposit, amenities, and listing controls — plus **address autocomplete** that fills city, state, and ZIP |
| **Rent by the room** | Rent a house room by room: each room has its own rent, deposit, tenant, lease, and listing |
| **Public listings** | A marketing page (`/listings`) with online applications; vacant rooms list individually, and featured properties pin to the top |
| **Tenants** | Pipeline from lead → applicant → tenant → past tenant, with one-click stage moves |
| **Applications** | Online applications with **custom questions**, an automatic income-to-rent check, and income verification |
| **Tenant screening** | Track credit/criminal/eviction screening through any FCRA bureau — the applicant pays, you pay nothing ([how it works](docs/HOW-IT-WORKS.md)) |
| **Leases** | Writes a complete lease from your data — summary, rent and deposits, penalties and fees, and full clauses, with your own fee amounts and house rules set once in Settings |
| **E-signatures, built in** | Emails each signer a private link; they read the lease, consent, and sign by typing or drawing their name. Full audit trail — consent text, IP, timestamp, and a SHA-256 of the terms signed — printed as a certificate of completion. Unlimited, no per-document fee, no second service |
| **Signing app (optional)** | `npm run esign` starts [OpenSign](https://www.opensignlabs.com) next to OpenTenant and shows it inside the app, for signing documents that aren't leases |
| **Rent** | Schedule rent up to 24 months ahead, accept any method (Zelle, ACH, card, cash, check), automatic past-due tracking |
| **Bank deposits** | Import bank/Zelle/Cash App statements. The app works out **which account** the statement came from, assigns each deposit to the tenant who paid, sorts withdrawals into **expense categories** (electric, mortgage, insurance…), and **asks** rather than guessing when something looks like money already on the books |
| **Tenant portal** | Private per-tenant link: balance due, **"I paid this"** reporting (you approve), payment history, maintenance requests |
| **Repairs** | Requests with priority and status workflow, from tenants or you |
| **Documents** | Track leases, addenda, and notices from draft → sent → signed |
| **Condition reports** | 12-area move-in/move-out checklists that lock when completed |
| **Accounting** | **Per property**: what each house earns after its own costs, per month, per year, and over 5 years, with a portfolio total. **Per bank**: what each account holds, carried forward from a balance you set. Plus expenses by category and an income-vs-expense chart |
| **Email notifications** | Connect Gmail (or any SMTP) and the app confirms applications, alerts you to new ones, sends approval/denial notices, rent reminders, portal invites, maintenance updates, and **month-end rent receipts** with your business name and address |
| **How-to guides** | Built-in guides for screening, rent collection, room rentals, and reconciliation |

## Screenshots

| | |
|---|---|
| **Bank deposits** — import a statement, and each deposit is matched to the tenant who paid ![Banking](docs/screenshots/banking.png) | **Rent by the room** — each room has its own rent, tenant, and listing ![Rooms](docs/screenshots/rooms.png) |
| **Rent** — tenant-reported payments queue for one-click approval ![Payments](docs/screenshots/payments.png) | **Tenant portal** — balance due, "I paid this", history, maintenance ![Tenant portal](docs/screenshots/portal.png) |
| **Accounting** — income vs expenses, categories, net profit ![Accounting](docs/screenshots/accounting.png) | **Public listings** — whole homes and single rooms, apply online ![Listings](docs/screenshots/listings.png) |
| **Application review** — income check, verification, screening ![Application detail](docs/screenshots/application-detail.png) | **Condition reports** — move-in/move-out checklists ![Condition report](docs/screenshots/condition-report.png) |

## Quick start

Requires **Node.js ≥ 22.13**. The PocketBase database binary installs through npm, so there is
nothing else to download.

```bash
git clone https://github.com/Shionjee7/Open-Tentant.git
cd Open-Tentant
npm run setup
```

That installs dependencies, builds, starts the database, and serves the app. Open
http://localhost:3000 and click **Load demo data** to explore every module with sample records,
or add your first property and start clean.

For day-to-day development, run `npm run pb` in one terminal and `npm run dev` in another.
Everything lives in `data/pb_data/` — back up that folder and you've backed up everything. The
database console is at http://127.0.0.1:8090/_/.

## Signing leases

Open a lease and press **Send for signature**. Each tenant gets a private link by email,
reads the lease in their browser, agrees to sign electronically, and signs by typing or
drawing their name. You sign from the lease page. When the last person signs, everyone is
emailed their copy and the lease is marked signed.

Every signature carries the record that makes it hold up — the consent agreed to, word
for word; the time; the IP address; and a SHA-256 fingerprint of the exact terms shown.
Edit the lease afterwards and the fingerprint stops matching, so the app tells you instead
of quietly disagreeing with its own signatures. It all prints with the lease as a
certificate of completion. (Not legal advice — some documents can't be signed
electronically at all.)

### Signing something that isn't a lease

```bash
npm run esign
```

That starts [OpenSign](https://www.opensignlabs.com) — an open-source signing app — as
extra containers alongside OpenTenant, and it appears under **Signing app** in the menu,
inside the app rather than at a separate address. Documents stay on your machine. Needs
Docker; nothing else changes if you skip it.

## Deploy it (get a real URL)

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for Render (one-click blueprint included), Railway,
Fly.io, and plain Docker. Two things matter wherever you host it:

- **Turn on a login gate** — either `ADMIN_PASSWORD` (a shared password) or Google sign-in
  (below). Without one, the app runs open, which is fine on your laptop and *not* fine on a
  public URL.
- **Mount a persistent volume and point `DATA_DIR` at it** (e.g. `DATA_DIR=/var/data`) so
  your data survives restarts.

With Docker on any server you own:

```bash
ADMIN_PASSWORD="a-long-random-password" docker compose up -d
```

### Signing in with Google

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   OAuth client (type: **Web application**).
2. Add the authorized redirect URI: `https://your-domain.com/api/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_ALLOWED_EMAILS`, then restart.

Only the emails in `GOOGLE_ALLOWED_EMAILS` can get in — having a valid Google account is not
enough by itself. Settings → **Sign-in & security** shows whether the gate is actually on.

### Who can reach what

| Route | Access |
|---|---|
| `/`, `/properties`, `/payments`, `/banking`, … | You — sign-in required |
| `/listings`, `/apply/[id]` | Public, by design (prospects browse and apply) |
| `/portal/[token]` | The tenant holding that unguessable link |

## Configuration

Every setting is optional — the app runs with none of them.

| Variable | What it does |
|---|---|
| `ADMIN_PASSWORD` | Shared-password login. Either this or Google sign-in is required for any public deployment. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in credentials from the Google Cloud Console. |
| `GOOGLE_ALLOWED_EMAILS` | Comma-separated emails allowed to sign in with Google. Required — no allowlist, no Google access. |
| `AUTH_SECRET` | Signs session cookies. Set it on any real deployment. |
| `DATA_DIR` | Where the database lives. Point at your mounted volume. |
| `PB_ADMIN_PASSWORD` | Database console password. Change it on any shared machine. |
| `PB_PORT` / `PB_URL` | Where PocketBase listens / how the app reaches it. |
| `PORT` | Port to listen on (default 3000). |
| `GEOCODER_URL` | Your own Nominatim/Photon instance for address autocomplete. |
| `GEOCODER_CONTACT` | Contact string sent with geocoding requests. |
| `APP_URL` | Public address, used for links inside emails. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Email account. Also settable in Settings. |
| `SMTP_FROM_NAME` / `SMTP_FROM_EMAIL` / `SMTP_NOTIFY_EMAIL` | Sender identity and where your alerts go. |

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, Server Components + Server Actions)
- [Tailwind CSS 4](https://tailwindcss.com)
- [PocketBase](https://github.com/pocketbase/pocketbase) (MIT) — database, REST API, and admin
  console, running as its own process with SQLite storage
- TypeScript

Everything it depends on is free and open source. Schema changes migrate automatically on
startup, so upgrading is `git pull` with no manual steps.

## Roadmap

- [ ] Per-user roles (today every signed-in account has full access)
- [ ] Optional Stripe integration for in-app card & ACH payments
- [ ] Direct e-sign API integration instead of pasted links
- [ ] File uploads in the UI (the collections already accept them)
- [ ] Native PDF statement parsing (today: paste the text, or import CSV)
- [ ] Listing syndication feeds
- [ ] Rent reporting to credit bureaus

Contributions welcome — this project exists so no landlord has to pay rent on their own
software.

## License

[MIT](LICENSE) — use it, change it, sell it, just keep the copyright notice.

Third-party licenses and attribution are documented in [NOTICE.md](NOTICE.md). Short
version: every bundled dependency is permissively licensed, and the AGPL e-signature tools
are separate services OpenTenant talks to over the network rather than code it includes —
so publishing this under MIT is fine.
