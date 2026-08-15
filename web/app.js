/**
 * OpenTenant, as a plain browser app.
 *
 * A hash router, a render function per screen, and direct calls to PocketBase.
 * No framework and no build step: this file is served to the browser exactly as
 * written. PocketBase serves it and answers the API, so running the whole app
 * means running one binary.
 */

import * as api from "./api.js";
import { esc, money, moneyExact, monthLabel, monthKey, monthlyLedger, shortDate, sumBy, titleCase } from "./lib.js";
import { renderMonths } from "./months.js";
import {
  personTies,
  propertyForm,
  removePerson,
  rentForm,
  saveProperty,
  saveTenant,
  scheduleRent,
  tenantForm,
} from "./forms.js";

const NAV = [
  { href: "#/", label: "Home", icon: "▦", hint: "This month at a glance" },
  { href: "#/money", label: "Money", icon: "$", hint: "What you kept, month by month" },
  { href: "#/rent", label: "Rent", icon: "◷", hint: "Who has paid and who hasn't" },
  { href: "#/properties", label: "Properties", icon: "⌂", hint: "Your places and rooms" },
  { href: "#/tenants", label: "Tenants", icon: "☺", hint: "Who lives where" },
  { href: "#/repairs", label: "Repairs", icon: "⚒", hint: "Requests from you or tenants" },
  { href: "#/settings", label: "Settings", icon: "⚙", hint: "Your details and setup" },
];

const app = document.getElementById("app");
let menuOpen = false;

/* ---------------- shell ---------------- */

function currentRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  return hash.split("?")[0].replace(/\/$/, "") || "/";
}

/** Anything after the "?" in the hash, e.g. #/property/abc?tab=rent. */
function routeParams() {
  const hash = location.hash.replace(/^#/, "");
  return new URLSearchParams(hash.split("?")[1] || "");
}

/** The menu entry a page belongs to, so a sub-page still lights one up. */
function navFor(route) {
  if (route.startsWith("/property/")) return NAV.find((i) => i.href === "#/properties");
  if (route.startsWith("/tenant/")) return NAV.find((i) => i.href === "#/tenants");
  if (route.startsWith("/rent/")) return NAV.find((i) => i.href === "#/rent");
  return NAV.find((item) => item.href === `#${route}`) ?? NAV[0];
}

function shell(inner) {
  const route = currentRoute();
  const here = navFor(route);
  const user = api.currentUser();

  return `
    <div class="shell">
      <aside class="sidebar${menuOpen ? " open" : ""}" id="menu">
        <div class="brand">
          <span class="brand-mark">O</span>
          <span>
            <span class="brand-name">OpenTenant</span>
            <span class="brand-sub">Free · Open Source</span>
          </span>
        </div>
        <nav class="menu">
          ${NAV.map(
            (item) => `
            <a href="${item.href}"${item.href === `#${route}` ? ' aria-current="page"' : ""}>
              <span class="icon">${item.icon}</span>
              <span>
                <span class="label">${esc(item.label)}</span>
                <span class="hint">${esc(item.hint)}</span>
              </span>
            </a>`
          ).join("")}
        </nav>
        <div class="sidebar-foot">
          ${user ? `<div>${esc(user.email)}</div>` : ""}
          <button type="button" data-action="sign-out">Sign out</button>
        </div>
      </aside>
      ${menuOpen ? '<button class="scrim" data-action="close-menu" aria-label="Close menu"></button>' : ""}
      <div style="flex:1;min-width:0">
        <header class="topbar">
          <button type="button" data-action="open-menu" aria-label="Open menu" aria-controls="menu">☰</button>
          <div>
            <div class="title">${esc(here.label)}</div>
            <div class="sub">${esc(here.hint)}</div>
          </div>
        </header>
        <main class="main">${inner}</main>
      </div>
    </div>`;
}

function head(title, sub, action = "") {
  return `
    <div class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        ${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
      </div>
      ${action}
    </div>`;
}

function stat(label, value, hint = "", tone = "") {
  return `
    <div class="card stat">
      <div class="k">${esc(label)}</div>
      <div class="v ${tone}">${esc(value)}</div>
      ${hint ? `<div class="h">${esc(hint)}</div>` : ""}
    </div>`;
}

function steps(items) {
  return `<ol class="steps">${items
    .map(
      (s, i) => `
      <li>
        <a href="${s.href}">
          <span class="n">${s.done ? "✓" : i + 1}</span>
          <span>
            <span class="t">${esc(s.label)}</span>
            <span class="s">${esc(s.detail)}</span>
          </span>
        </a>
      </li>`
    )
    .join("")}</ol>`;
}

function hub(links) {
  return `<nav class="hub">${links
    .map(
      (l) => `<a href="${l.href}"><div class="t">${esc(l.label)}</div><div class="s">${esc(l.detail)}</div></a>`
    )
    .join("")}</nav>`;
}

/* ---------------- screens ---------------- */

async function loadMoney() {
  const [transactions, payments] = await Promise.all([
    api.list("transactions"),
    api.list("payments"),
  ]);
  return { transactions, payments, rows: monthlyLedger(transactions, payments, 12) };
}

async function screenHome() {
  const [{ rows }, properties, people, maintenance] = await Promise.all([
    loadMoney(),
    api.list("properties"),
    api.list("people"),
    api.list("maintenance_requests"),
  ]);

  if (properties.length === 0) {
    return (
      head("Welcome to OpenTenant", "Free, open-source property management.") +
      `<div class="card card-body">
        <h2>Let's get you set up</h2>
        <p class="sub muted" style="margin-top:.35rem">Add the first house and the rest follows.</p>
        ${steps([
          { href: "#/properties", label: "Add a property", detail: "The house or apartment you rent out." },
          { href: "#/tenants", label: "Add your tenants", detail: "Who lives where." },
          { href: "#/rent", label: "Schedule the rent", detail: "Set it once, then tick off who paid." },
        ])}
      </div>`
    );
  }

  const thisMonth = rows[rows.length - 1];
  const booked = rows.some((r) => r.income > 0 || r.expenses > 0);
  const tenants = people.filter((p) => p.stage === "tenant");
  const open = maintenance.filter((m) => m.status === "new" || m.status === "in_progress");
  const occupied = properties.filter((p) => p.status === "occupied").length;

  return (
    head("Home", "This month at a glance") +
    (booked
      ? `<section class="card" style="margin-bottom:1.25rem">
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:flex-end">
            <div>
              <div class="hero-k">Kept in ${esc(monthLabel(thisMonth.month))} so far</div>
              <div class="hero-v ${thisMonth.net < 0 ? "bad" : ""}">${esc(money(thisMonth.net))}</div>
              <div class="hero-sub">${esc(money(thisMonth.income))} in · ${esc(money(thisMonth.expenses))} out</div>
            </div>
            <a class="btn-secondary" href="#/money">See every month →</a>
          </div>
          <div style="border-top:1px solid var(--line-soft)">${renderMonths(rows.slice(-6))}</div>
        </section>`
      : "") +
    `<div class="grid grid-2 grid-md-4">
      ${stat("Properties", properties.length, `${occupied} rented`)}
      ${stat("Tenants", tenants.length)}
      ${stat("Open repairs", open.length, "new + in progress", open.length ? "bad" : "")}
      ${stat("Rent this month", money(thisMonth.rentDue), `${money(thisMonth.rentPaid)} received`, "good")}
    </div>`
  );
}

async function screenMoney() {
  const { transactions, rows } = await loadMoney();
  const started = rows.some((r) => r.income > 0 || r.expenses > 0);

  if (!started) {
    return (
      head("Money", "What came in, what went out, and what you kept.") +
      `<div class="card card-body">
        <h2>Nothing to count yet</h2>
        <p class="sub muted" style="margin-top:.35rem">Mark some rent as paid, and the months fill in.</p>
        ${steps([
          { href: "#/properties", label: "Add a property", detail: "Skip if your houses are already in." },
          { href: "#/rent", label: "Schedule the rent", detail: "Set it once for the year." },
          { href: "#/rent", label: "Tick off who paid", detail: "Each payment books itself as income." },
        ])}
      </div>`
    );
  }

  const thisMonth = rows[rows.length - 1];
  const finished = rows.filter((r) => !r.current && (r.income > 0 || r.expenses > 0));
  const average = finished.length ? sumBy(finished, (r) => r.net) / finished.length : 0;
  const best = finished.reduce((top, r) => (!top || r.net > top.net ? r : top), null);
  const kept = sumBy(transactions.filter((t) => t.type === "income"), (t) => t.amount)
    - sumBy(transactions.filter((t) => t.type === "expense"), (t) => t.amount);

  return (
    head("Money", "What came in, what went out, and what you kept.") +
    `<section class="card">
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-end">
        <div>
          <div class="hero-k">Kept in ${esc(monthLabel(thisMonth.month))} so far</div>
          <div class="hero-v ${thisMonth.net < 0 ? "bad" : ""}">${esc(money(thisMonth.net))}</div>
          <div class="hero-sub">${esc(money(thisMonth.income))} in · ${esc(money(thisMonth.expenses))} out</div>
        </div>
        <dl style="display:flex;flex-wrap:wrap;gap:2rem">
          <div>
            <dt class="hero-k">Usual month</dt>
            <dd style="margin:.2rem 0 0;font-size:1.25rem;font-weight:600">${esc(money(average))}</dd>
            <dd class="small muted" style="margin:0">across ${finished.length} finished month${finished.length === 1 ? "" : "s"}</dd>
          </div>
          ${best
            ? `<div>
                <dt class="hero-k">Best month</dt>
                <dd style="margin:.2rem 0 0;font-size:1.25rem;font-weight:600">${esc(money(best.net))}</dd>
                <dd class="small muted" style="margin:0">${esc(monthLabel(best.month))}</dd>
              </div>`
            : ""}
          <div>
            <dt class="hero-k">Kept all time</dt>
            <dd style="margin:.2rem 0 0;font-size:1.25rem;font-weight:600">${esc(money(kept))}</dd>
            <dd class="small muted" style="margin:0">income minus every expense</dd>
          </div>
        </dl>
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Month by month</h2></div>
      ${renderMonths(rows)}
    </section>`
  );
}

async function screenRent() {
  const [payments, people, properties, leases] = await Promise.all([
    api.list("payments", { sort: "due_date" }),
    api.list("people"),
    api.list("properties"),
    api.list("leases"),
  ]);

  const live = properties.filter((p) => !p.archived);
  const chosen = routeParams().get("property") || "";
  const month = routeParams().get("month") || monthKey();
  const propertyOf = new Map(leases.map((l) => [l.id, l.property]));
  const personHome = new Map(people.map((p) => [p.id, p.property]));
  const person = new Map(people.map((p) => [p.id, p]));

  const houseOf = (charge) =>
    (charge.lease && propertyOf.get(charge.lease)) || personHome.get(charge.person) || "";

  const inMonth = payments.filter((c) => String(c.due_date ?? "").slice(0, 7) === month);
  const rows = chosen ? inMonth.filter((c) => houseOf(c) === chosen) : inMonth;
  const paid = rows.filter((c) => c.status === "paid");
  const owed = rows.filter((c) => c.status !== "paid");

  const picker = `
    <form data-form="rent-filter" class="card card-body" style="display:flex;flex-wrap:wrap;gap:.85rem;align-items:flex-end;margin-bottom:1.25rem">
      <div class="field" style="margin:0;min-width:14rem;flex:1">
        <label for="f-house">Property</label>
        <select id="f-house" name="property">
          <option value="">All properties</option>
          ${live.map((p) => `<option value="${esc(p.id)}"${p.id === chosen ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="margin:0">
        <label for="f-month">Month</label>
        <input id="f-month" name="month" type="month" value="${esc(month)}" />
      </div>
      <button class="btn-secondary" type="submit">Show</button>
    </form>`;

  const heading = chosen ? live.find((p) => p.id === chosen)?.name ?? "Property" : "All properties";

  return (
    head(
      "Rent",
      "Pick a house, see who owes what",
      `<a class="btn" href="#/rent/new">+ Schedule rent</a>`
    ) +
    picker +
    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${stat("Rent due", money(sumBy(rows, (c) => c.amount)), `${esc(heading)}, ${esc(monthLabel(month))}`)}
      ${stat("Received", money(sumBy(paid, (c) => c.amount)), `${paid.length} of ${rows.length}`, "good")}
      ${stat("Still owed", money(sumBy(owed, (c) => c.amount)), `${owed.length} charge${owed.length === 1 ? "" : "s"}`, owed.length ? "bad" : "")}
      ${stat("People", new Set(rows.map((c) => c.person)).size)}
    </div>` +
    (rows.length === 0
      ? `<div class="card empty">Nothing scheduled for ${esc(monthLabel(month))}${chosen ? " at this property" : ""}.</div>`
      : `<section class="card"><ul class="rows">${rows
          .map((c) => {
            const who = person.get(c.person);
            const name = who ? `${who.first_name ?? ""} ${who.last_name ?? ""}`.trim() : "Unassigned";
            const home = live.find((p) => p.id === houseOf(c));
            return `
            <li>
              <div style="min-width:0">
                ${who
                  ? `<a class="t" href="#/tenant/${esc(who.id)}" style="color:var(--brand-700)">${esc(name)} →</a>`
                  : `<div class="t">${esc(name)}</div>`}
                <div class="s">${who?.email ? esc(who.email) : "No email"}${home ? ` · ${esc(home.name)}` : ""}</div>
                <div class="s">${esc(titleCase(c.type || "rent"))} · due ${esc(shortDate(c.due_date))}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <span style="font-weight:600">${esc(moneyExact(c.amount))}</span>
                <span class="tag ${c.status === "paid" ? "good" : "bad"}">${esc(titleCase(c.status))}</span>
                ${c.status !== "paid" ? `<button class="btn" data-action="mark-paid" data-id="${esc(c.id)}">Mark paid</button>` : ""}
              </div>
            </li>`;
          })
          .join("")}</ul></section>`)
  );
}

async function screenProperties() {
  const [all, units] = await Promise.all([api.list("properties"), api.list("units")]);
  const showRemoved = routeParams().get("removed") === "1";
  const removed = all.filter((p) => p.archived);
  const properties = showRemoved ? removed : all.filter((p) => !p.archived);

  if (showRemoved) {
    return (
      `<a href="#/properties" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Properties</a>` +
      head("Removed properties", "Their history is still in your books. Put one back any time.") +
      (removed.length === 0
        ? `<div class="card empty">Nothing removed.</div>`
        : `<section class="card"><ul class="rows">${removed
            .map(
              (p) => `
            <li>
              <div>
                <div class="t">${esc(p.name)}</div>
                <div class="s">${esc([p.address, p.city].filter(Boolean).join(", ") || "No address")}</div>
              </div>
              <button class="btn-secondary" data-action="restore-property" data-id="${esc(p.id)}">Put back</button>
            </li>`
            )
            .join("")}</ul></section>`)
    );
  }

  return (
    head(
      "Properties",
      "Your places and the rooms in them",
      `<a class="btn" href="#/property/new">+ Add property</a>`
    ) +
    (properties.length === 0
      ? `<div class="card empty">No properties yet. Add the first one to get started.</div>`
      : `<section class="card"><ul class="rows">${properties
          .map((p) => {
            const rooms = units.filter((u) => u.property === p.id);
            const filled = rooms.filter((u) => u.status === "occupied").length;
            return `
            <li>
              <a href="#/property/${esc(p.id)}" style="flex:1;min-width:0">
                <div class="t">${esc(p.name)} <span class="muted small">→</span></div>
                <div class="s">${esc([p.address, p.city, p.state].filter(Boolean).join(", ") || "No address")}</div>
              </a>
              <div style="display:flex;align-items:center;gap:.6rem">
                <span class="small muted">${rooms.length ? `${filled}/${rooms.length} rooms` : money(p.rent) + "/mo"}</span>
                <span class="tag ${p.status === "occupied" ? "good" : ""}">${esc(titleCase(p.status || "vacant"))}</span>
              </div>
            </li>`;
          })
          .join("")}</ul></section>`) +
    (removed.length > 0
      ? `<p class="small" style="margin-top:1rem"><a href="#/properties?removed=1" style="color:var(--brand-600)">Show removed (${removed.length})</a></p>`
      : "")
  );
}

/**
 * One house, and everything that belongs to it.
 *
 * The alternative was what we had: a global rent list, a global tenant list, a
 * global expense list, and you holding in your head which rows belonged to
 * which house. Open the house instead and its rent, its people, its costs and
 * its papers are all right there.
 */
async function screenProperty() {
  const id = currentRoute().split("/")[2];
  const tab = routeParams().get("tab") || "overview";

  const [property, units, people, leases, payments, transactions, documents] = await Promise.all([
    api.one("properties", id),
    api.list("units"),
    api.list("people"),
    api.list("leases"),
    api.list("payments"),
    api.list("transactions"),
    api.list("documents"),
  ]);
  if (!property) return head("Not found", "") + `<div class="card empty">That property no longer exists.</div>`;

  const rooms = units.filter((u) => u.property === id);
  const ours = people.filter((p) => p.property === id);
  const residents = ours.filter((p) => p.stage !== "past");
  const ourLeases = leases.filter((l) => l.property === id);
  const leaseIds = new Set(ourLeases.map((l) => l.id));
  // Everyone who has ever been at this house, not only whoever is here now —
  // last year's tenant moving out must not take last year's rent with them.
  const personIds = new Set(ours.map((p) => p.id));
  // A charge belongs to this house if its lease does, or failing that, if the
  // person it is for lives here.
  const charges = payments
    .filter((p) => (p.lease ? leaseIds.has(p.lease) : personIds.has(p.person)))
    .sort((a, b) => String(b.due_date).localeCompare(String(a.due_date)));
  const costs = transactions
    .filter((t) => t.property === id && t.type === "expense")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const income = transactions.filter((t) => t.property === id && t.type === "income");
  const papers = documents.filter((d) => d.property === id);
  const nameOf = new Map(people.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));

  const owed = charges.filter((c) => c.status !== "paid");
  const kept = sumBy(income, (t) => t.amount) - sumBy(costs, (t) => t.amount);

  const byRoom = property.rental_type === "by_room" || rooms.length > 0;
  const TABS = [
    ["overview", "Overview"],
    ...(byRoom ? [["rooms", `Rooms (${rooms.length})`]] : []),
    ["rent", `Rent (${charges.length})`],
    ["people", `People (${residents.length})`],
    ["costs", `Expenses (${costs.length})`],
    ["papers", `Documents (${papers.length})`],
  ];

  const tabBar = `<nav class="tabs">${TABS.map(
    ([key, label]) =>
      `<a href="#/property/${esc(id)}?tab=${key}"${key === tab ? ' aria-current="page"' : ""}>${esc(label)}</a>`
  ).join("")}</nav>`;

  let body = "";

  if (tab === "overview") {
    body = `
      <div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
        ${stat(rooms.length ? "Rooms" : "Rent", rooms.length ? `${rooms.filter((r) => r.status === "occupied").length}/${rooms.length}` : `${money(property.rent)}/mo`, rooms.length ? "filled" : "")}
        ${stat("People here", residents.length)}
        ${stat("Still owed", money(sumBy(owed, (c) => c.amount)), `${owed.length} charge${owed.length === 1 ? "" : "s"}`, owed.length ? "bad" : "")}
        ${stat("Kept from this house", money(kept), "rent in, costs out", kept >= 0 ? "good" : "bad")}
      </div>
      <section class="card card-body">
        <h2>Details</h2>
        <div class="grid grid-sm-2" style="margin-top:.85rem">
          <div><span class="hero-k">Address</span><div>${esc([property.address, property.city, property.state, property.zip].filter(Boolean).join(", ") || "—")}</div></div>
          <div><span class="hero-k">Rented as</span><div>${property.rental_type === "by_room" ? "By the room" : "The whole place"}</div></div>
        </div>
        <div style="margin-top:1.25rem;border-top:1px solid var(--line-soft);padding-top:1rem">
          <button class="btn-secondary" data-action="delete-property"
            data-id="${esc(property.id)}" data-name="${esc(property.name)}"
            data-people="${residents.length}" data-leases="${ourLeases.filter((l) => l.status === "active" || l.status === "sent" || l.status === "signed").length}">
            Remove this property
          </button>
          <p class="small muted" style="margin-top:.5rem">
            Asks first, and is refused while anyone still lives here. Removing takes it off
            your list and keeps its history — you can put it back later.
          </p>
        </div>
      </section>`;
  }

  if (tab === "rooms") {
    // Rooms are edited in place. A five-bedroom house means five rents that
    // drift apart over time, and making each one a separate page to visit is
    // how they end up never being updated.
    const takenBy = new Map(
      people.filter((p) => p.unit && p.stage !== "past").map((p) => [p.unit, p])
    );
    const full = sumBy(rooms, (r) => r.rent);
    const now = sumBy(rooms.filter((r) => takenBy.has(r.id)), (r) => r.rent);

    body = rooms.length === 0
      ? `<div class="card empty">No rooms yet. <a href="#/property/${esc(id)}/edit" style="color:var(--brand-600)">Add some →</a></div>`
      : `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
          ${stat("Rooms", rooms.length, `${takenBy.size} filled`)}
          ${stat("Coming in now", money(now), "rooms with someone in them", "good")}
          ${stat("If every room fills", money(full), "per month")}
          ${stat("Empty", rooms.length - takenBy.size, money(full - now) + " not earning", full - now > 0 ? "bad" : "")}
        </div>
        <section class="card">
          <div class="roomlist">
            <div class="roomhead">
              <span>Room</span><span>Rent</span><span>Who's in it</span><span></span>
            </div>
            ${rooms
              .map((room) => {
                const who = takenBy.get(room.id);
                const name = who ? `${who.first_name ?? ""} ${who.last_name ?? ""}`.trim() : "";
                return `
              <form class="room" data-form="room" data-id="${esc(room.id)}">
                <div>
                  <label for="r-name-${esc(room.id)}">Room</label>
                  <input id="r-name-${esc(room.id)}" name="name" value="${esc(room.name)}" required />
                </div>
                <div>
                  <label for="r-rent-${esc(room.id)}">Rent ($)</label>
                  <input id="r-rent-${esc(room.id)}" name="rent" type="number" min="0" step="0.01" value="${esc(room.rent || "")}" />
                </div>
                <div class="who">
                  ${who
                    ? `<a href="#/tenant/${esc(who.id)}" style="color:var(--brand-600)">${esc(name)} →</a>`
                    : `<span class="muted">Empty</span>`}
                  <span data-role="status" class="muted small"></span>
                </div>
                <div class="acts">
                  <button class="btn-secondary" type="submit">Save</button>
                  <button type="button" class="btn-secondary" data-action="delete-room"
                    data-id="${esc(room.id)}" data-name="${esc(room.name)}" data-who="${esc(name)}"
                    style="color:var(--out);border-color:#f3c7c0">Remove</button>
                </div>
              </form>`;
              })
              .join("")}
          </div>
        </section>
        <p class="small muted" style="margin-top:.75rem">
          Add more rooms from <a href="#/property/${esc(id)}/edit" style="color:var(--brand-600)">Edit</a>.
        </p>`;
  }

  if (tab === "rent") {
    body = charges.length === 0
      ? `<div class="card empty">No rent scheduled for this house yet.</div>`
      : `<section class="card"><ul class="rows">${charges
          .map(
            (c) => `
          <li>
            <div>
              <div class="t">${esc(nameOf.get(c.person) || "Unassigned")} · ${esc(moneyExact(c.amount))}</div>
              <div class="s">${esc(titleCase(c.type || "rent"))} · due ${esc(shortDate(c.due_date))}</div>
            </div>
            <div style="display:flex;align-items:center;gap:.6rem">
              <span class="tag ${c.status === "paid" ? "good" : "bad"}">${esc(titleCase(c.status))}</span>
              ${c.status !== "paid" ? `<button class="btn" data-action="mark-paid" data-id="${esc(c.id)}">Mark paid</button>` : ""}
            </div>
          </li>`
          )
          .join("")}</ul></section>`;
  }

  if (tab === "people") {
    body = residents.length === 0
      ? `<div class="card empty">Nobody is living here yet.</div>`
      : `<section class="card"><ul class="rows">${residents
          .map((p) => {
            const room = rooms.find((r) => r.id === p.unit);
            return `
            <li>
              <div>
                <div class="t">${esc(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())}</div>
                <div class="s">${esc(p.email || "No email")}${room ? ` · ${esc(room.name)}` : ""}</div>
              </div>
              <span class="tag ${p.stage === "tenant" ? "good" : ""}">${esc(titleCase(p.stage))}</span>
            </li>`;
          })
          .join("")}</ul></section>`;
  }

  if (tab === "costs") {
    body = `
      <section class="card card-body" style="margin-bottom:1.25rem">
        <h2>Add an expense for this house</h2>
        <form data-form="expense" data-property="${esc(id)}" style="margin-top:.85rem">
          <div class="grid grid-sm-2">
            <div class="field" style="margin:0">
              <label for="x-date">Date</label>
              <input id="x-date" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field" style="margin:0">
              <label for="x-category">Category</label>
              <select id="x-category" name="category">
                ${["repairs", "utilities", "insurance", "taxes", "mortgage", "turnover", "other"]
                  .map((c) => `<option value="${c}">${titleCase(c)}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="field" style="margin:0">
              <label for="x-amount">Amount ($)</label>
              <input id="x-amount" name="amount" type="number" min="0" step="0.01" required />
            </div>
            <div class="field" style="margin:0">
              <label for="x-description">What was it?</label>
              <input id="x-description" name="description" placeholder="Electric bill" />
            </div>
          </div>
          <button class="btn" type="submit" style="margin-top:.85rem">Add expense</button>
        </form>
      </section>
      ${costs.length === 0
        ? `<div class="card empty">Nothing spent on this house yet.</div>`
        : `<section class="card"><ul class="rows">${costs
            .map(
              (t) => `
            <li>
              <div>
                <div class="t">${esc(t.description || titleCase(t.category))}</div>
                <div class="s">${esc(titleCase(t.category))} · ${esc(shortDate(t.date))}</div>
              </div>
              <span style="font-weight:600;color:var(--out)">−${esc(moneyExact(t.amount))}</span>
            </li>`
            )
            .join("")}</ul></section>`}`;
  }

  if (tab === "papers") {
    body = papers.length === 0
      ? `<div class="card empty">No documents filed against this house yet.</div>`
      : `<section class="card"><ul class="rows">${papers
          .map(
            (d) => `
          <li>
            <div>
              <div class="t">${esc(d.name)}</div>
              <div class="s">${esc(titleCase(d.type || "document"))} · ${esc(shortDate(d.created))}</div>
            </div>
            <span class="tag ${d.status === "signed" ? "good" : ""}">${esc(titleCase(d.status || "draft"))}</span>
          </li>`
          )
          .join("")}</ul></section>`;
  }

  return (
    `<a href="#/properties" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Properties</a>` +
    head(
      property.name,
      [property.address, property.city].filter(Boolean).join(", "),
      `<a class="btn-secondary" href="#/property/${esc(id)}/edit">Edit</a>`
    ) +
    tabBar +
    body
  );
}

async function screenTenants() {
  const [people, properties] = await Promise.all([api.list("people"), api.list("properties")]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const showRemoved = routeParams().get("removed") === "1";
  const removed = people.filter((p) => p.archived);
  const tenants = showRemoved ? removed : people.filter((p) => !p.archived);
  const nameOf = (p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();

  if (showRemoved) {
    return (
      `<a href="#/tenants" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Tenants</a>` +
      head("Removed people", "Their rent history is still in your books. Put one back any time.") +
      (removed.length === 0
        ? `<div class="card empty">Nobody removed.</div>`
        : `<section class="card"><ul class="rows">${removed
            .map(
              (p) => `
            <li>
              <div>
                <div class="t">${esc(nameOf(p))}</div>
                <div class="s">${esc(p.email || "No email")}</div>
              </div>
              <button class="btn-secondary" data-action="restore-tenant" data-id="${esc(p.id)}">Put back</button>
            </li>`
            )
            .join("")}</ul></section>`)
    );
  }

  return (
    head("Tenants", "Who lives where", `<a class="btn" href="#/tenant/new">+ Add person</a>`) +
    hub([
      { href: "#/rent", label: "Rent", detail: "What each tenant owes this month" },
      { href: "#/repairs", label: "Repairs", detail: "What they've reported" },
    ]) +
    (tenants.length === 0
      ? `<div class="card empty">No tenants yet.</div>`
      : `<section class="card"><ul class="rows">${tenants
          .map(
            (p) => `
          <li>
            <a href="#/tenant/${esc(p.id)}" style="flex:1;min-width:0">
              <div class="t">${esc(nameOf(p))} <span class="muted small">→</span></div>
              <div class="s">${esc(p.email || "No email")}${p.property ? ` · ${esc(propertyName.get(p.property) || "")}` : ""}</div>
            </a>
            <span class="tag ${p.stage === "tenant" ? "good" : ""}">${esc(titleCase(p.stage === "past" ? "past tenant" : p.stage))}</span>
          </li>`
          )
          .join("")}</ul></section>`) +
    (removed.length > 0
      ? `<p class="small" style="margin-top:1rem"><a href="#/tenants?removed=1" style="color:var(--brand-600)">Show removed (${removed.length})</a></p>`
      : "")
  );
}

async function screenRepairs() {
  const [requests, properties] = await Promise.all([
    api.list("maintenance_requests"),
    api.list("properties"),
  ]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const open = requests.filter((r) => r.status === "new" || r.status === "in_progress");

  return (
    head("Repairs", "Requests from you or your tenants") +
    (requests.length === 0
      ? `<div class="card empty">Nothing reported. That's a good day.</div>`
      : `<section class="card">
          <div class="card-head"><h2>${open.length} open</h2></div>
          <ul class="rows">${requests
            .map(
              (r) => `
            <li>
              <div>
                <div class="t">${esc(r.title)}</div>
                <div class="s">${esc(propertyName.get(r.property) || "")} · ${esc(shortDate(r.created))}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.5rem">
                <span class="tag ${r.priority === "urgent" || r.priority === "high" ? "bad" : ""}">${esc(titleCase(r.priority || "medium"))}</span>
                <span class="tag ${r.status === "completed" ? "good" : "warn"}">${esc(titleCase(r.status))}</span>
              </div>
            </li>`
            )
            .join("")}</ul>
        </section>`)
  );
}

async function screenSettings() {
  const settings = await api.list("settings");
  const value = (key) => settings.find((s) => s.key === key)?.value ?? "";

  return (
    head("Settings", "Your details, used on leases and receipts") +
    `<section class="card card-body">
      <form data-form="settings">
        <div class="field">
          <label for="business_name">Business name</label>
          <input id="business_name" name="business_name" value="${esc(value("business_name"))}" placeholder="Your rentals" />
        </div>
        <div class="field">
          <label for="business_address">Business address</label>
          <input id="business_address" name="business_address" value="${esc(value("business_address"))}" />
        </div>
        <div class="field">
          <label for="payment_instructions">How tenants should pay</label>
          <textarea id="payment_instructions" name="payment_instructions" rows="3">${esc(value("payment_instructions"))}</textarea>
        </div>
        <div style="margin-top:1rem;display:flex;gap:.6rem;align-items:center">
          <button class="btn" type="submit">Save</button>
          <span class="small muted" data-role="settings-status"></span>
        </div>
      </form>
    </section>`
  );
}

/* ---------------- sign in ---------------- */

function signInScreen(message = "") {
  return `
    <div class="signin">
      <div class="card card-body">
        <div class="brand" style="padding:0 0 1rem">
          <span class="brand-mark">O</span>
          <span>
            <span class="brand-name" style="color:var(--ink-900)">OpenTenant</span>
            <span class="brand-sub" style="color:var(--ink-500)">Free · Open Source</span>
          </span>
        </div>
        <h2>Sign in</h2>
        <p class="small muted" style="margin-top:.3rem">
          Your data stays on this machine. The password is printed in the terminal
          the first time you start OpenTenant.
        </p>
        <form data-form="signin" style="margin-top:1rem">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required minlength="8"
              autocomplete="current-password" />
          </div>
          ${message ? `<p class="note warn" style="margin-top:.85rem">${esc(message)}</p>` : ""}
          <button class="btn" type="submit" style="margin-top:1rem;width:100%;justify-content:center">
            Sign in
          </button>
        </form>
      </div>
    </div>`;
}

/* ---------------- router ---------------- */

const ROUTES = {
  "/": screenHome,
  "/money": screenMoney,
  "/rent": screenRent,
  "/properties": screenProperties,
  "/tenants": screenTenants,
  "/repairs": screenRepairs,
  "/settings": screenSettings,
};

async function render() {
  if (!api.signedIn()) {
    app.innerHTML = signInScreen();
    return;
  }

  const route = currentRoute();
  let screen = ROUTES[route] ?? screenHome;
  if (route === "/property/new") screen = () => propertyForm(null);
  else if (/^\/property\/[^/]+\/edit$/.test(route)) screen = () => propertyForm(route.split("/")[2]);
  else if (route.startsWith("/property/")) screen = screenProperty;
  else if (route === "/tenant/new") screen = () => tenantForm(null);
  else if (route.startsWith("/tenant/")) screen = () => tenantForm(route.split("/")[2]);
  else if (route === "/rent/new") screen = rentForm;
  app.innerHTML = shell(`<div class="empty">Loading…</div>`);
  try {
    const html = await screen();
    app.innerHTML = shell(html);
    syncForms();
  } catch (error) {
    app.innerHTML = shell(
      `<div class="card card-body"><h2>Something went wrong</h2>
       <p class="sub muted" style="margin-top:.35rem">${esc(error.message)}</p></div>`
    );
  }
}

/**
 * The parts of a form that depend on another answer.
 *
 * Asking "how many rooms?" of somebody renting out a whole house is noise, and
 * offering the rooms of a house they didn't pick is worse than noise — it files
 * a tenant into a bedroom in the wrong building. Both are decided here, once
 * after every render and again whenever the answer changes.
 */
function syncForms() {
  const picked = document.querySelector('input[name="rental_type"]:checked');
  if (picked) {
    for (const block of document.querySelectorAll("[data-when]")) {
      block.hidden = block.dataset.when !== picked.value;
    }
  }

  const property = document.querySelector('[data-role="property-picker"]');
  const rooms = document.getElementById("f-unit");
  if (property && rooms) {
    let available = 0;
    for (const option of rooms.options) {
      if (!option.value) continue;
      const mine = option.dataset.property === property.value;
      option.hidden = !mine;
      option.disabled = !mine;
      if (mine) available++;
    }
    // A room from the house they just moved away from is not their room.
    if (rooms.selectedOptions[0]?.disabled) rooms.value = "";
    rooms.closest('[data-role="room-field"]').hidden = available === 0;
  }
}

/* ---------------- events ---------------- */

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-menu" || action === "close-menu") {
    menuOpen = action === "open-menu";
    document.getElementById("menu")?.classList.toggle("open", menuOpen);
    render();
    return;
  }
  if (action === "sign-out") {
    api.signOut();
    location.hash = "#/";
    render();
    return;
  }
  if (action === "mark-paid") {
    target.disabled = true;
    const id = target.dataset.id;
    const payment = await api.one("payments", id);
    await api.update("payments", id, {
      status: "paid",
      paid_date: new Date().toISOString().slice(0, 10),
    });
    // Rent that arrives is income; book it so the month view adds up.
    const lease = payment?.lease ? await api.one("leases", payment.lease) : null;
    await api.create("transactions", {
      property: lease?.property ?? "",
      date: new Date().toISOString().slice(0, 10),
      type: "income",
      category: "rent",
      amount: Number(payment?.amount) || 0,
      description: "Rent",
      payment: id,
    });
    render();
    return;
  }
  if (action === "delete-property") {
    const { id, name } = target.dataset;
    const people = Number(target.dataset.people) || 0;
    const leases = Number(target.dataset.leases) || 0;

    // Refuse while the house is in use — deleting it would strand the people
    // and the lease that point at it.
    if (people > 0) {
      alert(`${name} still has ${people} ${people === 1 ? "person" : "people"} living there.\n\nMove them out first, then you can remove the property.`);
      return;
    }
    if (leases > 0) {
      alert(`${name} still has ${leases} active lease${leases === 1 ? "" : "s"}.\n\nEnd the lease first, then you can remove the property.`);
      return;
    }

    // Name the property in the question, so a mis-click on the wrong row is
    // obvious before anything happens.
    if (!confirm(`Remove ${name}?\n\nIt comes off your list. Its rent history, expenses and documents stay in your books, and you can put it back from "Show removed".`)) {
      return;
    }

    // Archived, not deleted. Leases and repairs hold a required reference to
    // the property, so destroying it would either fail outright or take the
    // history with it — and a landlord needs last year's numbers.
    await api.update("properties", id, { archived: true });
    location.hash = "#/properties";
    render();
    return;
  }
  if (action === "restore-property") {
    await api.update("properties", target.dataset.id, { archived: false });
    render();
    return;
  }
  if (action === "delete-tenant") {
    const { id, name } = target.dataset;
    target.disabled = true;
    const ties = await personTies(id);

    // Two different questions, because they have two different answers. Nothing
    // is attached: they really do disappear, and the question says so. Something
    // is attached: they come off the list and the money stays, and the question
    // says that instead. Neither one lies about what the button does.
    const question =
      ties.total === 0
        ? `Delete ${name}?\n\nThey have no rent, leases or repairs on file, so this removes them completely. It cannot be undone.`
        : `Remove ${name}?\n\nThey come off your tenant list. Their rent history stays in your books` +
          `${ties.leases ? ", and so do their leases" : ""}, and you can put them back from "Show removed".`;

    if (!confirm(question)) {
      target.disabled = false;
      return;
    }

    await removePerson(id, ties);
    location.hash = "#/tenants";
    render();
    return;
  }
  if (action === "delete-room") {
    const { id, name, who } = target.dataset;
    if (who) {
      alert(`${who} is living in ${name}.\n\nMove them to another room, or off the property, before removing it.`);
      return;
    }
    if (!confirm(`Remove ${name}?\n\nThe room goes for good. Rent already charged against it stays in your books.`)) {
      return;
    }
    await api.remove("units", id);
    render();
    return;
  }
  if (action === "restore-tenant") {
    await api.update("people", target.dataset.id, { archived: false });
    render();
    return;
  }
});

// Conditional bits of a form react as soon as the answer changes, not on save.
document.addEventListener("change", (event) => {
  if (event.target.matches('input[name="rental_type"], [data-role="property-picker"]')) {
    syncForms();
  }
  // Picking a house on the rent screen should just show that house.
  if (event.target.closest('[data-form="rent-filter"]')) {
    event.target.form.requestSubmit();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  if (form.dataset.form === "signin") {
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await api.signIn(data.email, data.password);
      render();
    } catch (error) {
      app.innerHTML = signInScreen(error.message);
    }
    return;
  }

  if (form.dataset.form === "expense") {
    const button = form.querySelector("button");
    button.disabled = true;
    await api.create("transactions", {
      property: form.dataset.property,
      date: data.date,
      type: "expense",
      category: data.category || "other",
      amount: Number(data.amount) || 0,
      description: data.description || titleCase(data.category || "expense"),
    });
    render();
    return;
  }

  if (form.dataset.form === "property") {
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('[data-role="status"]');
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      const property = await saveProperty(form.dataset.id || null, data);
      location.hash = `#/property/${property.id}`;
      render();
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
    return;
  }

  if (form.dataset.form === "tenant") {
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector('[data-role="status"]');
    button.disabled = true;
    status.textContent = "Saving…";
    try {
      await saveTenant(form.dataset.id || null, data);
      location.hash = "#/tenants";
      render();
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message;
    }
    return;
  }

  if (form.dataset.form === "rent") {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    await scheduleRent(data);
    location.hash = "#/rent";
    render();
    return;
  }

  if (form.dataset.form === "room") {
    const status = form.querySelector('[data-role="status"]');
    status.textContent = " · Saving…";
    await api.update("units", form.dataset.id, {
      name: data.name,
      rent: Number(data.rent) || 0,
    });
    status.textContent = " · Saved";
    return;
  }

  if (form.dataset.form === "rent-filter") {
    const query = new URLSearchParams();
    if (data.property) query.set("property", String(data.property));
    if (data.month) query.set("month", String(data.month));
    location.hash = `#/rent${query.toString() ? `?${query}` : ""}`;
    render();
    return;
  }

  if (form.dataset.form === "settings") {
    const status = form.querySelector('[data-role="settings-status"]');
    status.textContent = "Saving…";
    const existing = await api.list("settings");
    for (const [key, value] of Object.entries(data)) {
      const row = existing.find((s) => s.key === key);
      if (row) await api.update("settings", row.id, { value: String(value) });
      else await api.create("settings", { key, value: String(value) });
    }
    status.textContent = "Saved";
  }
});

window.addEventListener("hashchange", () => {
  menuOpen = false;
  render();
});

render();
