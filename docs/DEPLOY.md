# Deploying OpenTenant

OpenTenant is a normal Docker web app that stores everything in one SQLite file
at `/app/data/opentenant.db`. Two rules make every deploy work:

1. **Mount a persistent volume at `/app/data`** — otherwise your properties,
   tenants, and payments reset every time the service restarts.
2. **Set `ADMIN_PASSWORD`** — without it the landlord dashboard is open to anyone
   who has the URL. (See [Security](#security) below.)

---

## Option A — Render (blueprint included)

1. Push this repo to GitHub (already done).
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect the repo.
3. Render reads `render.yaml`, builds the Dockerfile, and generates a strong
   `ADMIN_PASSWORD` for you — find it under the service's **Environment** tab.
4. Open the URL Render gives you (`https://opentenant-xxxx.onrender.com`) and sign in.

The blueprint requests a 1 GB disk mounted at `/app/data`, which requires a paid
instance (~$7/mo). To test on the free tier instead, delete the `disk:` block in
`render.yaml` — everything works, but data resets on restart.

## Option B — Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Railway detects the `Dockerfile` automatically.
3. Add a **Volume** mounted at `/app/data`.
4. Add a variable `ADMIN_PASSWORD` with a long random password.
5. Under **Settings → Networking**, click **Generate Domain** for a public URL.

## Option C — Fly.io

```bash
fly launch --no-deploy          # detects the Dockerfile
fly volumes create data --size 1
fly secrets set ADMIN_PASSWORD="a-long-random-password"
```

Add the mount to `fly.toml`:

```toml
[[mounts]]
  source = "data"
  destination = "/app/data"
```

Then `fly deploy`.

## Option D — Any server you own (Docker)

```bash
git clone https://github.com/Shionjee7/Open-Tentant.git
cd Open-Tentant
ADMIN_PASSWORD="a-long-random-password" docker compose up -d
```

Runs on port 3000 with `./data` on the host holding your database. Put it behind
Caddy, nginx, or Cloudflare Tunnel for HTTPS.

---

## Security

OpenTenant separates **your** pages from **public** pages:

| Route | Who can reach it |
|---|---|
| `/`, `/properties`, `/payments`, `/accounting`, … | You — password required |
| `/listings`, `/apply/[id]` | Anyone (that's the point — prospects apply) |
| `/portal/[token]` | The tenant holding that unguessable link |

Set `ADMIN_PASSWORD` to a long random string before exposing the app to the
internet. Without it the gate is disabled and **anyone with the URL can see and
edit everything** — fine on your laptop, not fine on a public host.

Tenant portal links are random UUIDs, so they act as magic links: anyone with a
tenant's link can see that tenant's balance and history. Share them privately,
and treat them like passwords.

## Backups

Everything is in one file. Copy it and you have a full backup:

```bash
# Docker
docker compose cp opentenant:/app/data/opentenant.db ./backup-$(date +%F).db

# Local
cp data/opentenant.db ~/backups/opentenant-$(date +%F).db
```

Restore by putting the file back at `data/opentenant.db` and restarting.
