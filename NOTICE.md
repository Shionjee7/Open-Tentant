# Third-party licenses and attribution

OpenTenant is released under the [MIT License](LICENSE). This file records what it
depends on, under what terms, and why publishing OpenTenant under MIT is compatible
with all of it.

## Bundled dependencies (shipped in the app)

| Project | License | Notes |
|---|---|---|
| [Next.js](https://github.com/vercel/next.js) | MIT | Web framework |
| [React](https://github.com/facebook/react) | MIT | UI library |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | Styling |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Build-time only |
| [PocketBase](https://github.com/pocketbase/pocketbase) | MIT | Database, REST API, admin console |
| [Nodemailer](https://github.com/nodemailer/nodemailer) | MIT-0 | Sending email over SMTP |
| SQLite (inside PocketBase) | Public domain | Storage engine |

All permissive. None of them require OpenTenant to adopt their license, and MIT is
compatible with each.

## Services OpenTenant talks to but does not include

These are **separate programs** you run or subscribe to yourself. OpenTenant links to
them or calls their HTTP APIs; none of their code is copied into or linked with this
codebase.

| Project | License | How OpenTenant uses it |
|---|---|---|
| [OpenSign](https://github.com/OpenSignLabs/OpenSign) | AGPL-3.0 | Optional signing app — `npm run esign` pulls the official images and runs it as sibling containers; OpenTenant frames it and optionally calls its REST API |
| [MongoDB Community](https://github.com/mongodb/mongo) | SSPL-1.0 | OpenSign's database, started with it by the same command |
| [Caddy](https://github.com/caddyserver/caddy) | Apache-2.0 | Puts the OpenSign app and its API on one origin so it can be framed |
| [Documenso](https://github.com/documenso/documenso) | AGPL-3.0 | Alternative e-signature provider |
| [DocuSeal](https://github.com/docusealco/docuseal) | AGPL-3.0 | Alternative e-signature provider |
| [Nominatim / OpenStreetMap](https://nominatim.org) | Data: ODbL | Address autocomplete |

### Why AGPL services don't make OpenTenant AGPL

AGPL-3.0's copyleft applies to the licensed work and to modified or derivative versions
of it. Communicating with a separate program over a network API — which is all
OpenTenant does — does not create a derivative work of that program. OpenTenant contains
no OpenSign, Documenso, or DocuSeal source code, links against none of their libraries,
and runs as its own process. So OpenTenant stays MIT and can be published freely.

**What this means for you as an operator:** if you self-host stock OpenSign without
modifying it, you have nothing further to do. If you *modify* OpenSign and let others use
it over a network, AGPL §13 requires you to offer your modified OpenSign source to those
users. That obligation attaches to your OpenSign deployment, not to OpenTenant.

**On bundling it.** `npm run esign` and the `esign` Docker Compose profile do not
redistribute OpenSign — they name official images that Docker pulls from the registry at
run time, the same as typing `docker run` yourself. This repository contains a compose
file and a Caddy config, not OpenSign's code. Naming a program in a config file is not
distributing it, so MIT publication is unaffected.

### MongoDB and the SSPL

The bundled signing app needs MongoDB, which is licensed under the SSPL — not an
OSI-approved open source license. Two things make that a non-issue here. First, the
SSPL's condition only triggers if you *offer MongoDB itself as a service* to third
parties; running it as the private database of your own application does not. Second,
OpenTenant neither includes nor redistributes MongoDB — Docker pulls the official image
when you ask for the signing app, and never otherwise. If you would rather not run it at
all, don't: leases are signed by OpenTenant itself, with no MongoDB anywhere.

### OpenStreetMap attribution (required)

Address autocomplete uses Nominatim, whose data is licensed under the
[Open Database License (ODbL)](https://www.openstreetmap.org/copyright). ODbL requires
attribution, so the app credits "Address data © OpenStreetMap contributors" wherever
suggestions appear. **Keep that attribution** if you modify the address field.

Nominatim's public instance also has a
[usage policy](https://operations.osmfoundation.org/policies/nominatim/): at most one
request per second, and a valid identifying User-Agent. OpenTenant honors both — requests
are debounced and proxied server-side with a proper User-Agent. For heavy use, run your
own Nominatim or Photon instance and set `GEOCODER_URL`.

## Paid features are never required

Everything OpenTenant does works without paying anyone:

- **E-signatures cost nothing.** OpenTenant collects lease signatures itself —
  unlimited, with a full audit trail — so no signing service is required at all.
  OpenSign's REST API is a paid feature; the bundled OpenSign app is the free
  self-hosted build, used through its own interface, and the API integration only
  switches on if you happen to have a token.
- **Bank connection aggregators charge per account.** OpenTenant imports statements
  instead, which every bank exports for free.
- **Screening bureaus charge per report**, and the applicant pays them directly.

## Your own license choice

OpenTenant ships as MIT: anyone may use, modify, and redistribute it, including
commercially, as long as they keep the copyright notice. If you would rather require that
anyone who modifies it and runs it as a service publish their changes, AGPL-3.0 is the
usual alternative — you may relicense your own project at any time by replacing `LICENSE`
and updating the reference in `README.md` and `package.json`.
