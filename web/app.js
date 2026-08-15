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

function navFor(route) {
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
  const [payments, people, properties] = await Promise.all([
    api.list("payments", { sort: "due_date" }),
    api.list("people"),
    api.list("properties"),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
  const month = monthKey();
  const due = payments.filter((p) => String(p.due_date ?? "").slice(0, 7) === month);
  const paid = due.filter((p) => p.status === "paid");

  return (
    head("Rent", "Who has paid and who hasn't") +
    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${stat("Due this month", money(sumBy(due, (p) => p.amount)))}
      ${stat("Received", money(sumBy(paid, (p) => p.amount)), "", "good")}
      ${stat("Still owed", money(sumBy(due.filter((p) => p.status !== "paid"), (p) => p.amount)), "", "bad")}
      ${stat("Ticked off", `${paid.length}/${due.length}`)}
    </div>
    <section class="card">
      <div class="card-head"><h2>${esc(monthLabel(month))} — every charge</h2></div>
      ${due.length === 0
        ? `<p class="empty">Nothing scheduled for this month.</p>`
        : `<ul class="rows">${due
            .map(
              (p) => `
            <li>
              <div>
                <div class="t">${esc(nameOf.get(p.person) || "Unassigned")} · ${esc(moneyExact(p.amount))}</div>
                <div class="s">${esc(titleCase(p.type || "rent"))} · due ${esc(shortDate(p.due_date))}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <span class="tag ${p.status === "paid" ? "good" : "bad"}">${esc(titleCase(p.status))}</span>
                ${p.status !== "paid"
                  ? `<button class="btn" data-action="mark-paid" data-id="${esc(p.id)}">Mark paid</button>`
                  : ""}
              </div>
            </li>`
            )
            .join("")}</ul>`}
    </section>`
  );
}

async function screenProperties() {
  const [properties, units] = await Promise.all([api.list("properties"), api.list("units")]);

  return (
    head(
      "Properties",
      "Your places and the rooms in them",
      `<button class="btn" data-action="add-property">+ Add property</button>`
    ) +
    (properties.length === 0
      ? `<div class="card empty">No properties yet. Add the first one to get started.</div>`
      : `<section class="card"><ul class="rows">${properties
          .map((p) => {
            const rooms = units.filter((u) => u.property === p.id);
            const filled = rooms.filter((u) => u.status === "occupied").length;
            return `
            <li>
              <div>
                <div class="t">${esc(p.name)}</div>
                <div class="s">${esc([p.address, p.city, p.state].filter(Boolean).join(", ") || "No address")}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.6rem">
                <span class="small muted">${rooms.length ? `${filled}/${rooms.length} rooms` : money(p.rent) + "/mo"}</span>
                <span class="tag ${p.status === "occupied" ? "good" : ""}">${esc(titleCase(p.status || "vacant"))}</span>
              </div>
            </li>`;
          })
          .join("")}</ul></section>`)
  );
}

async function screenTenants() {
  const [people, properties] = await Promise.all([api.list("people"), api.list("properties")]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const tenants = people.filter((p) => p.stage === "tenant");

  return (
    head("Tenants", "Who lives where") +
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
            <div>
              <div class="t">${esc(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())}</div>
              <div class="s">${esc(p.email || "No email")}${p.property ? ` · ${esc(propertyName.get(p.property) || "")}` : ""}</div>
            </div>
            <span class="tag good">Tenant</span>
          </li>`
          )
          .join("")}</ul></section>`)
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

  const screen = ROUTES[currentRoute()] ?? screenHome;
  app.innerHTML = shell(`<div class="empty">Loading…</div>`);
  try {
    const html = await screen();
    app.innerHTML = shell(html);
  } catch (error) {
    app.innerHTML = shell(
      `<div class="card card-body"><h2>Something went wrong</h2>
       <p class="sub muted" style="margin-top:.35rem">${esc(error.message)}</p></div>`
    );
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
  if (action === "add-property") {
    const name = prompt("What do you call this property?");
    if (!name) return;
    await api.create("properties", {
      name,
      status: "vacant",
      rental_type: "whole",
      listed: false,
    });
    render();
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
