/**
 * One person, and everything about them.
 *
 * Reached by clicking a name anywhere — the rent list, a property's People tab,
 * a room. It answers the questions a landlord actually has about a tenant: what
 * are they on the hook for, have they paid, how did they pay it, and where is
 * the paperwork.
 */

import * as api from "./api.js";
import { esc, money, moneyExact, shortDate, sumBy, titleCase } from "./lib.js";
import { methodLabel } from "./statements.js";

export async function screenPerson(id) {
  const [person, properties, units, leases, payments, documents, requests] = await Promise.all([
    api.one("people", id),
    api.list("properties"),
    api.list("units"),
    api.list("leases"),
    api.list("payments", { sort: "-due_date" }),
    api.list("documents"),
    api.list("maintenance_requests"),
  ]);
  if (!person) return `<div class="card empty">That person no longer exists.</div>`;

  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "This person";
  const home = properties.find((p) => p.id === person.property);
  const room = units.find((u) => u.id === person.unit);
  const theirLeases = leases.filter((l) => (l.tenants ?? []).includes(id));
  const leaseIds = new Set(theirLeases.map((l) => l.id));
  const charges = payments.filter((c) => c.person === id);
  const papers = documents.filter((d) => d.lease && leaseIds.has(d.lease));
  const theirRequests = requests.filter((r) => r.person === id);

  const owed = charges.filter((c) => c.status !== "paid");
  const paid = charges.filter((c) => c.status === "paid");

  // How they actually pay. A landlord chasing rent wants to know whether to
  // check Zelle or the mailbox, and the answer is whatever they did last time.
  const methods = new Map();
  for (const c of paid) {
    if (!c.method) continue;
    methods.set(c.method, (methods.get(c.method) || 0) + 1);
  }
  const usual = [...methods.entries()].sort((a, b) => b[1] - a[1])[0];

  const backTo = home ? `#/property/${home.id}?tab=people` : "#/tenants";

  return (
    `<a href="${esc(backTo)}" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← ${esc(home ? home.name : "Tenants")}</a>` +
    `<div class="page-head">
      <div>
        <h1>${esc(name)}</h1>
        <p class="sub">
          ${esc(titleCase(person.stage === "past" ? "past tenant" : person.stage || "tenant"))}${
            home ? ` at ${esc(home.name)}` : ""
          }${room ? ` · ${esc(room.name)}` : ""}
        </p>
      </div>
      <div style="display:flex;gap:.5rem">
        <a class="btn-secondary" href="#/tenant/${esc(id)}/edit">Edit</a>
      </div>
    </div>` +

    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${tile("Owes now", money(sumBy(owed, (c) => c.amount)), `${owed.length} charge${owed.length === 1 ? "" : "s"}`, owed.length ? "bad" : "good")}
      ${tile("Paid to date", money(sumBy(paid, (c) => c.amount)), `${paid.length} payment${paid.length === 1 ? "" : "s"}`, "good")}
      ${tile("Usually pays by", usual ? methodLabel(usual[0]) : "—", usual ? `${usual[1]} time${usual[1] === 1 ? "" : "s"}` : "no payments yet")}
      ${tile("Lease", theirLeases.some((l) => l.status === "active") ? "Active" : theirLeases.length ? titleCase(theirLeases[0].status) : "None")}
    </div>` +

    `<section class="card card-body" style="margin-bottom:1.25rem">
      <h2>How to reach them</h2>
      <div class="grid grid-sm-2" style="margin-top:.85rem">
        <div>
          <span class="hero-k">Email</span>
          <div>${person.email ? `<a href="mailto:${esc(person.email)}" style="color:var(--brand-600)">${esc(person.email)}</a>` : "—"}</div>
        </div>
        <div>
          <span class="hero-k">Phone</span>
          <div>${person.phone ? `<a href="tel:${esc(person.phone)}" style="color:var(--brand-600)">${esc(person.phone)}</a>` : "—"}</div>
        </div>
      </div>
      ${person.notes ? `<p class="small muted" style="margin-top:.85rem">${esc(person.notes)}</p>` : ""}
    </section>` +

    leaseSection(theirLeases, properties, units, id, name) +
    documentSection(papers, theirLeases) +
    chargeSection(charges) +
    requestSection(theirRequests)
  );
}

function tile(label, value, hint = "", tone = "") {
  return `
    <div class="card stat">
      <div class="k">${esc(label)}</div>
      <div class="v ${tone}">${esc(value)}</div>
      ${hint ? `<div class="h">${esc(hint)}</div>` : ""}
    </div>`;
}

/**
 * Their leases, and the door out of one.
 *
 * Taking somebody off a lease is its own act: the lease itself survives,
 * because the other tenants are still on it and last year's terms are still
 * what last year's rent was charged under.
 */
function leaseSection(leases, properties, units, personId, personName) {
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));
  const roomOf = new Map(units.map((u) => [u.id, u.name]));

  return `
    <section class="card" style="margin-bottom:1.25rem">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem">
        <h2>Lease</h2>
        <a class="small" href="#/lease/new?person=${esc(personId)}" style="color:var(--brand-600)">+ Start a lease</a>
      </div>
      ${leases.length === 0
        ? `<div class="empty">Not on a lease yet.</div>`
        : `<ul class="rows">${leases
            .map(
              (l) => `
          <li>
            <div style="min-width:0">
              <div class="t">${esc(nameOf.get(l.property) || "A property")}${l.unit ? ` · ${esc(roomOf.get(l.unit) || "")}` : ""}</div>
              <div class="s">
                ${esc(moneyExact(l.rent))}/mo · ${esc(shortDate(l.start_date))} to ${esc(shortDate(l.end_date))}
                · ${(l.tenants ?? []).length} tenant${(l.tenants ?? []).length === 1 ? "" : "s"}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class="tag ${l.status === "active" ? "good" : ""}">${esc(titleCase(l.status || "draft"))}</span>
              <button class="btn-secondary" data-action="leave-lease"
                data-id="${esc(l.id)}" data-person="${esc(personId)}" data-name="${esc(personName)}"
                data-property="${esc(nameOf.get(l.property) || "this property")}"
                data-others="${(l.tenants ?? []).length - 1}"
                style="color:var(--out);border-color:#f3c7c0">Take off lease</button>
            </div>
          </li>`
            )
            .join("")}</ul>`}
    </section>`;
}

function documentSection(papers, leases) {
  const leaseFor = new Set(leases.map((l) => l.id));
  return `
    <section class="card" style="margin-bottom:1.25rem">
      <div class="card-head"><h2>Their paperwork</h2></div>
      ${papers.length === 0
        ? `<div class="empty">
            No documents on their lease yet. Upload one from the property's
            <span class="muted">Documents</span> tab.
          </div>`
        : `<ul class="rows">${papers
            .map((d) => {
              const file = (d.file ?? [])[0];
              return `
            <li>
              <div style="min-width:0">
                ${file
                  ? `<a class="t" href="${esc(api.fileUrl("documents", d.id, file))}" target="_blank" rel="noopener"
                       style="color:var(--brand-700)">${esc(d.name)} ↗</a>`
                  : `<div class="t">${esc(d.name)}</div>`}
                <div class="s">${esc(titleCase(d.type || "document"))} · ${esc(shortDate(d.created))}${
                  leaseFor.has(d.lease) ? " · on their lease" : ""
                }</div>
              </div>
              <span class="tag ${d.status === "signed" ? "good" : ""}">${esc(titleCase(d.status || "draft"))}</span>
            </li>`;
            })
            .join("")}</ul>`}
    </section>`;
}

/** Every charge, and for the settled ones, how the money actually arrived. */
function chargeSection(charges) {
  return `
    <section class="card" style="margin-bottom:1.25rem">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem">
        <h2>Payments</h2>
        <a class="small" href="#/rent/new" style="color:var(--brand-600)">+ Schedule rent</a>
      </div>
      ${charges.length === 0
        ? `<div class="empty">Nothing charged to them yet.</div>`
        : `<ul class="rows">${charges
            .map(
              (c) => `
          <li>
            <div style="min-width:0">
              <div class="t">${esc(moneyExact(c.amount))} · ${esc(titleCase(c.type || "rent"))}</div>
              <div class="s">
                Due ${esc(shortDate(c.due_date))}${
                  c.status === "paid"
                    ? ` · paid ${esc(shortDate(c.paid_date))}${c.method ? ` by ${esc(methodLabel(c.method))}` : ""}`
                    : ""
                }
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class="tag ${c.status === "paid" ? "good" : "bad"}">${esc(titleCase(c.status))}</span>
              <a class="btn-secondary" href="#/payment/${esc(c.id)}">Edit</a>
            </div>
          </li>`
            )
            .join("")}</ul>`}
    </section>`;
}

function requestSection(requests) {
  if (requests.length === 0) return "";
  return `
    <section class="card">
      <div class="card-head"><h2>What they've reported</h2></div>
      <ul class="rows">${requests
        .map(
          (r) => `
        <li>
          <div>
            <div class="t">${esc(r.title)}</div>
            <div class="s">${esc(shortDate(r.created))}</div>
          </div>
          <span class="tag ${r.status === "completed" ? "good" : "warn"}">${esc(titleCase(r.status))}</span>
        </li>`
        )
        .join("")}</ul>
    </section>`;
}
