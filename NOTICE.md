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
| SQLite (via Node's built-in `node:sqlite`) | Public domain | Storage engine |

All permissive. None of them require OpenTenant to adopt their license, and MIT is
compatible with each.

## Services OpenTenant talks to but does not include

These are **separate programs** you run or subscribe to yourself. OpenTenant links to
them or calls their HTTP APIs; none of their code is copied into or linked with this
codebase.

| Project | License | How OpenTenant uses it |
|---|---|---|
| [OpenSign](https://github.com/OpenSignLabs/OpenSign) | AGPL-3.0 | Lease e-signatures — you run your own instance; the app links to it and optionally calls its REST API |
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

- **OpenSign's REST API is a paid feature.** OpenTenant therefore defaults to the free
  path — it generates the lease, you upload it to your own free self-hosted OpenSign and
  send it, then paste the signing link back. The API integration exists and switches on
  automatically if you happen to have a token, but nothing depends on it.
- **Bank connection aggregators charge per account.** OpenTenant imports statements
  instead, which every bank exports for free.
- **Screening bureaus charge per report**, and the applicant pays them directly.

## Your own license choice

OpenTenant ships as MIT: anyone may use, modify, and redistribute it, including
commercially, as long as they keep the copyright notice. If you would rather require that
anyone who modifies it and runs it as a service publish their changes, AGPL-3.0 is the
usual alternative — you may relicense your own project at any time by replacing `LICENSE`
and updating the reference in `README.md` and `package.json`.
