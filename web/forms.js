/**
 * The add and edit screens.
 *
 * Two rules run through all of them. Nothing is ever a browser prompt — a
 * landlord typing an address deserves a real form. And editing is the same
 * screen as adding, because rent changes, people move, and a thing you can
 * only enter once is a thing you'll end up keeping in a spreadsheet instead.
 */

import * as api from "./api.js";
import { esc, money, moneyExact, shortDate, sumBy, titleCase } from "./lib.js";
import { CATEGORIES, METHODS } from "./statements.js";

function field(label, name, value = "", type = "text", extra = "") {
  return `
    <div class="field">
      <label for="f-${name}">${esc(label)}</label>
      <input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra} />
    </div>`;
}

/**
 * Add or edit a property.
 *
 * "How is it rented?" drives the rest: one rent for the whole place, or a room
 * count and a price per room. Choosing by-the-room on a new property builds the
 * rooms for you — the alternative is adding five rooms by hand, five times.
 */
export async function propertyForm(id) {
  const property = id ? await api.one("properties", id) : null;
  if (id && !property) return `<div class="card empty">That property no longer exists.</div>`;

  const rooms = id ? (await api.list("units")).filter((u) => u.property === id) : [];
  const accounts = id ? (await api.list("bank_accounts")).filter((a) => a.property === id) : [];
  const account = accounts[0] ?? null;
  const byRoom = property ? property.rental_type === "by_room" : false;

  return (
    `<a href="${id ? `#/property/${esc(id)}` : "#/properties"}" class="small"
        style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Back</a>` +
    `<div class="page-head"><div><h1>${id ? "Edit property" : "Add a property"}</h1>
      <p class="sub">${id ? "Change anything here — new rent applies to charges you make from now on." : "The house or apartment you rent out."}</p></div></div>` +
    `<form data-form="property" ${id ? `data-id="${esc(id)}"` : ""} class="card card-body" style="max-width:44rem">
      <h2>Name and address</h2>
      <div style="margin-top:.85rem">
        ${field("Property name", "name", property?.name ?? "", "text", "required placeholder=\"Maple Street House\"")}
        ${field("Street address", "address", property?.address ?? "")}
        <div class="grid grid-sm-2" style="gap:.85rem">
          ${field("City", "city", property?.city ?? "")}
          <div class="grid grid-2" style="gap:.85rem">
            ${field("State", "state", property?.state ?? "")}
            ${field("ZIP", "zip", property?.zip ?? "")}
          </div>
        </div>
      </div>

      <h2 style="margin-top:1.75rem">How is it rented?</h2>
      <div class="choices" style="margin-top:.6rem">
        <label class="choice">
          <input type="radio" name="rental_type" value="whole" ${byRoom ? "" : "checked"} />
          <span><strong>The whole place</strong><span class="small muted">One rent, one lease.</span></span>
        </label>
        <label class="choice">
          <input type="radio" name="rental_type" value="by_room" ${byRoom ? "checked" : ""} />
          <span><strong>By the room</strong><span class="small muted">Each room its own tenant and rent.</span></span>
        </label>
      </div>

      <div data-when="whole" style="margin-top:1rem"${byRoom ? " hidden" : ""}>
        <div class="grid grid-sm-2" style="gap:.85rem">
          ${field("Monthly rent ($)", "rent", property?.rent || "", "number", 'min="0" step="0.01"')}
          ${field("Security deposit ($)", "deposit", property?.deposit || "", "number", 'min="0" step="0.01"')}
        </div>
      </div>

      <div data-when="by_room" style="margin-top:1rem"${byRoom ? "" : " hidden"}>
        ${rooms.length > 0
          ? `<p class="note good">This property already has ${rooms.length} room${rooms.length === 1 ? "" : "s"}.
             Change a room's own rent from the property's Rooms tab — the boxes below only add more.</p>
             <div class="grid grid-sm-2" style="gap:.85rem;margin-top:.85rem">
               ${field("Add how many more rooms?", "room_count", "", "number", 'min="0" max="20" step="1" placeholder="0"')}
               ${field("Rent per new room ($)", "room_rent", "", "number", 'min="0" step="0.01"')}
             </div>
             ${field("Deposit per new room ($)", "room_deposit", "", "number", 'min="0" step="0.01"')}`
          : `<div class="grid grid-sm-2" style="gap:.85rem">
               ${field("How many rooms?", "room_count", "", "number", 'min="1" max="20" step="1" placeholder="5"')}
               ${field("Rent per room ($)", "room_rent", "", "number", 'min="0" step="0.01" placeholder="850"')}
             </div>
             ${field("Deposit per room ($)", "room_deposit", "", "number", 'min="0" step="0.01"')}
             <p class="small muted">Rooms are created for you, named Room 1, Room 2 and so on. You can rename them and set a different rent per room afterwards.</p>`}
      </div>

      <h2 style="margin-top:1.75rem">Where the rent lands</h2>
      <p class="small muted" style="margin-top:.2rem">
        The account this property's rent is deposited into. Never enter a full account number —
        the last four digits are enough to tell accounts apart.
      </p>
      <div class="grid grid-sm-2" style="gap:.85rem;margin-top:.85rem">
        ${field("Account nickname", "account_name", account?.name ?? "", "text", 'placeholder="Rent checking"')}
        ${field("Bank", "account_institution", account?.institution ?? "", "text", 'placeholder="Chase"')}
      </div>
      ${field("Last 4 digits", "account_last4", account?.last4 ?? "", "text", 'inputmode="numeric" maxlength="4" placeholder="4821"')}

      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center">
        <button class="btn" type="submit">${id ? "Save changes" : "Add property"}</button>
        <a class="btn-secondary" href="${id ? `#/property/${esc(id)}` : "#/properties"}">Cancel</a>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`
  );
}

/** Add or edit a person, and say which house — and which room — they're in. */
export async function tenantForm(id) {
  const person = id ? await api.one("people", id) : null;
  if (id && !person) return `<div class="card empty">That person no longer exists.</div>`;

  const [properties, units, payments] = await Promise.all([
    api.list("properties"),
    api.list("units"),
    id ? api.list("payments", { sort: "-due_date" }) : Promise.resolve([]),
  ]);
  const live = properties.filter((p) => !p.archived);
  const stages = ["tenant", "applicant", "lead", "past"];
  const name = person ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() : "";

  // Their money, on the same screen as their details — clicking a name from the
  // rent list should answer "do they owe me anything?" without another hop.
  const theirs = payments.filter((p) => p.person === id);
  const owed = theirs.filter((p) => p.status !== "paid");
  const history = !id
    ? ""
    : `<section class="card" style="margin-top:1.25rem">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem">
          <h2>Their rent</h2>
          <span class="small ${owed.length ? "" : "muted"}" ${owed.length ? 'style="color:var(--out);font-weight:600"' : ""}>
            ${owed.length ? `${esc(money(sumBy(owed, (p) => p.amount)))} owed` : "All settled"}
          </span>
        </div>
        ${theirs.length === 0
          ? `<div class="empty">No rent scheduled for them yet. <a href="#/rent/new" style="color:var(--brand-600)">Schedule some →</a></div>`
          : `<ul class="rows">${theirs
              .slice(0, 12)
              .map(
                (p) => `
              <li>
                <div>
                  <div class="t">${esc(moneyExact(p.amount))}</div>
                  <div class="s">${esc(titleCase(p.type || "rent"))} · due ${esc(shortDate(p.due_date))}</div>
                </div>
                <span class="tag ${p.status === "paid" ? "good" : "bad"}">${esc(titleCase(p.status))}</span>
              </li>`
              )
              .join("")}</ul>`}
      </section>`;

  return (
    `<a href="#/tenants" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Tenants</a>` +
    `<div class="page-head"><div><h1>${id ? esc(name) || "Edit person" : "Add a person"}</h1>
      <p class="sub">${id ? "Their details, and what they owe." : "A tenant, an applicant, or someone who enquired."}</p></div></div>` +
    `<form data-form="tenant" ${id ? `data-id="${esc(id)}"` : ""} class="card card-body" style="max-width:38rem">
      <div class="grid grid-sm-2" style="gap:.85rem">
        ${field("First name", "first_name", person?.first_name ?? "", "text", "required")}
        ${field("Last name", "last_name", person?.last_name ?? "")}
      </div>
      ${field("Email", "email", person?.email ?? "", "email", 'placeholder="them@example.com"')}
      ${field("Phone", "phone", person?.phone ?? "", "tel")}

      <div class="field">
        <label for="f-stage">They are a…</label>
        <select id="f-stage" name="stage">
          ${stages.map((s) => `<option value="${s}"${person?.stage === s ? " selected" : ""}>${titleCase(s === "past" ? "past tenant" : s)}</option>`).join("")}
        </select>
      </div>

      <div class="field">
        <label for="f-property">Which property?</label>
        <select id="f-property" name="property" data-role="property-picker">
          <option value="">Not assigned</option>
          ${live.map((p) => `<option value="${esc(p.id)}"${person?.property === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
      </div>

      <div class="field" data-role="room-field">
        <label for="f-unit">Which room? <span class="muted" style="text-transform:none">— only for by-the-room houses</span></label>
        <select id="f-unit" name="unit">
          <option value="">The whole place</option>
          ${units
            .map(
              (u) =>
                `<option value="${esc(u.id)}" data-property="${esc(u.property)}"${person?.unit === u.id ? " selected" : ""}>${esc(u.name)}</option>`
            )
            .join("")}
        </select>
      </div>

      ${field("Notes", "notes", person?.notes ?? "")}

      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center">
        <button class="btn" type="submit">${id ? "Save changes" : "Add person"}</button>
        <a class="btn-secondary" href="#/tenants">Cancel</a>
        ${id
          ? `<button type="button" class="btn-secondary" data-action="delete-tenant"
               data-id="${esc(id)}" data-name="${esc(name || "this person")}"
               style="margin-left:auto;color:var(--out);border-color:#f3c7c0">Remove person</button>`
          : ""}
        <span class="small muted" data-role="status"></span>
      </div>
    </form>` +
    history
  );
}

/** Schedule rent, for one person, for as many months ahead as you like. */
export async function rentForm() {
  const [properties, people, leases] = await Promise.all([
    api.list("properties"),
    api.list("people"),
    api.list("leases"),
  ]);
  const live = properties.filter((p) => !p.archived);
  const tenants = people.filter((p) => p.stage === "tenant");
  const today = new Date();
  const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  return (
    `<a href="#/rent" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Rent</a>` +
    `<div class="page-head"><div><h1>Schedule rent</h1>
      <p class="sub">Set it once for the year, then each month is a tick-off.</p></div></div>` +
    (tenants.length === 0
      ? `<div class="card empty">Add a tenant first — rent is charged to a person.</div>`
      : `<form data-form="rent" class="card card-body" style="max-width:38rem">
        <div class="field">
          <label for="f-person">Who pays it?</label>
          <select id="f-person" name="person" required>
            ${tenants
              .map((t) => {
                const home = live.find((p) => p.id === t.property);
                return `<option value="${esc(t.id)}">${esc(`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim())}${home ? ` — ${esc(home.name)}` : ""}</option>`;
              })
              .join("")}
          </select>
        </div>
        <div class="grid grid-sm-2" style="gap:.85rem">
          ${field("Amount ($)", "amount", "", "number", 'min="0" step="0.01" required placeholder="850"')}
          ${field("First due date", "due_date", first, "date", "required")}
        </div>
        <div class="grid grid-sm-2" style="gap:.85rem">
          <div class="field">
            <label for="f-type">What is it?</label>
            <select id="f-type" name="type">
              ${["rent", "deposit", "late_fee", "utility", "other"]
                .map((t) => `<option value="${t}">${titleCase(t)}</option>`)
                .join("")}
            </select>
          </div>
          ${field("Repeat for how many months?", "months", "12", "number", 'min="1" max="24" step="1"')}
        </div>
        <p class="small muted">Twelve makes a charge on the same day each month for a year.</p>
        <div style="margin-top:1.5rem;display:flex;gap:.6rem">
          <button class="btn" type="submit">Schedule it</button>
          <a class="btn-secondary" href="#/rent">Cancel</a>
        </div>
      </form>`)
  );
}

/**
 * Edit one charge.
 *
 * Rent is not always what was scheduled. Somebody pays half now and half on
 * Friday, a late fee gets waived, a payment lands in the wrong month. Without
 * this the only fix was the database.
 */
export async function paymentForm(id) {
  const charge = await api.one("payments", id);
  if (!charge) return `<div class="card empty">That charge no longer exists.</div>`;

  const [people, leases, properties] = await Promise.all([
    api.list("people"),
    api.list("leases"),
    api.list("properties"),
  ]);
  const person = people.find((p) => p.id === charge.person);
  const name = person ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() : "Unassigned";
  const home = properties.find((p) => p.id === (leases.find((l) => l.id === charge.lease)?.property || person?.property));
  const back = charge.person ? `#/tenant/${charge.person}` : "#/rent";

  return (
    `<a href="${esc(back)}" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Back</a>` +
    `<div class="page-head"><div><h1>Edit this charge</h1>
      <p class="sub">${esc(name)}${home ? ` · ${esc(home.name)}` : ""}</p></div></div>` +
    `<form data-form="payment" data-id="${esc(id)}" class="card card-body" style="max-width:38rem">
      <div class="field">
        <label for="f-person">Who owes it?</label>
        <select id="f-person" name="person">
          <option value="">Unassigned</option>
          ${people
            .filter((p) => !p.archived || p.id === charge.person)
            .map(
              (p) =>
                `<option value="${esc(p.id)}"${p.id === charge.person ? " selected" : ""}>${esc(
                  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
                )}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="grid grid-sm-2" style="gap:.85rem">
        ${field("Amount ($)", "amount", charge.amount ?? "", "number", 'min="0" step="0.01" required')}
        ${field("Due date", "due_date", charge.due_date ?? "", "date")}
      </div>

      <div class="grid grid-sm-2" style="gap:.85rem">
        <div class="field">
          <label for="f-type">What is it?</label>
          <select id="f-type" name="type">
            ${["rent", "deposit", "late_fee", "utility", "other"]
              .map((t) => `<option value="${t}"${charge.type === t ? " selected" : ""}>${titleCase(t)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-status">Where does it stand?</label>
          <select id="f-status" name="status">
            ${["unpaid", "paid", "partial", "late", "waived"]
              .map((s) => `<option value="${s}"${charge.status === s ? " selected" : ""}>${titleCase(s)}</option>`)
              .join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-sm-2" style="gap:.85rem">
        <div class="field">
          <label for="f-method">How did they pay?</label>
          <select id="f-method" name="method">
            <option value="">Not recorded</option>
            ${METHODS.map(
              ([key, label]) => `<option value="${key}"${charge.method === key ? " selected" : ""}>${esc(label)}</option>`
            ).join("")}
          </select>
        </div>
        ${field("Date they paid", "paid_date", charge.paid_date ?? "", "date")}
      </div>

      ${field("Note", "notes", charge.notes ?? "", "text", 'placeholder="Half now, half on Friday"')}

      <p class="small muted" style="margin-top:.85rem">
        Marking this paid books it as income. Changing it back takes that income
        out again, so the month stays honest either way.
      </p>

      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        <button class="btn" type="submit">Save changes</button>
        <a class="btn-secondary" href="${esc(back)}">Cancel</a>
        <button type="button" class="btn-secondary" data-action="delete-payment"
          data-id="${esc(id)}" data-name="${esc(name)}" data-amount="${esc(moneyExact(charge.amount))}"
          style="margin-left:auto;color:var(--out);border-color:#f3c7c0">Delete charge</button>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`
  );
}

/** Start a lease, or edit one. */
export async function leaseForm(id, presetPerson = "") {
  const lease = id ? await api.one("leases", id) : null;
  if (id && !lease) return `<div class="card empty">That lease no longer exists.</div>`;

  const [properties, units, people] = await Promise.all([
    api.list("properties"),
    api.list("units"),
    api.list("people"),
  ]);
  const live = properties.filter((p) => !p.archived);
  const tenants = people.filter((p) => !p.archived);
  const chosen = new Set(lease?.tenants ?? (presetPerson ? [presetPerson] : []));
  const person = people.find((p) => p.id === presetPerson);
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  return (
    `<a href="${presetPerson ? `#/tenant/${esc(presetPerson)}` : "#/properties"}" class="small"
        style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Back</a>` +
    `<div class="page-head"><div><h1>${id ? "Edit lease" : "Start a lease"}</h1>
      <p class="sub">Who is renting what, for how long, at what rent.</p></div></div>` +
    `<form data-form="lease" ${id ? `data-id="${esc(id)}"` : ""} class="card card-body" style="max-width:40rem">
      <div class="field">
        <label for="f-property">Which property?</label>
        <select id="f-property" name="property" data-role="property-picker" required>
          <option value="">Choose one</option>
          ${live
            .map(
              (p) =>
                `<option value="${esc(p.id)}"${
                  (lease?.property || person?.property) === p.id ? " selected" : ""
                }>${esc(p.name)}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="field" data-role="room-field">
        <label for="f-unit">Which room? <span class="muted" style="text-transform:none">— only for by-the-room houses</span></label>
        <select id="f-unit" name="unit">
          <option value="">The whole place</option>
          ${units
            .map(
              (u) =>
                `<option value="${esc(u.id)}" data-property="${esc(u.property)}"${
                  (lease?.unit || person?.unit) === u.id ? " selected" : ""
                }>${esc(u.name)}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="field">
        <label>Who is on it?</label>
        <div class="checks">
          ${tenants
            .map(
              (t) => `
            <label class="check">
              <input type="checkbox" name="tenant-${esc(t.id)}" ${chosen.has(t.id) ? "checked" : ""} />
              <span>${esc(`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim())}</span>
            </label>`
            )
            .join("")}
        </div>
        ${tenants.length === 0 ? `<p class="small muted">Add a person first — a lease needs somebody on it.</p>` : ""}
      </div>

      <div class="grid grid-sm-2" style="gap:.85rem">
        ${field("Starts", "start_date", lease?.start_date ?? today, "date", "required")}
        ${field("Ends", "end_date", lease?.end_date ?? nextYear.toISOString().slice(0, 10), "date")}
      </div>
      <div class="grid grid-sm-2" style="gap:.85rem">
        ${field("Monthly rent ($)", "rent", lease?.rent ?? "", "number", 'min="0" step="0.01"')}
        ${field("Deposit held ($)", "deposit", lease?.deposit ?? "", "number", 'min="0" step="0.01"')}
      </div>

      <div class="field">
        <label for="f-status">Where does it stand?</label>
        <select id="f-status" name="status">
          ${["draft", "sent", "signed", "active", "ended"]
            .map((s) => `<option value="${s}"${(lease?.status ?? "active") === s ? " selected" : ""}>${titleCase(s)}</option>`)
            .join("")}
        </select>
      </div>

      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center">
        <button class="btn" type="submit">${id ? "Save lease" : "Start it"}</button>
        <a class="btn-secondary" href="${presetPerson ? `#/tenant/${esc(presetPerson)}` : "#/properties"}">Cancel</a>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`
  );
}

/* ---------------- saving ---------------- */

export async function saveProperty(id, data) {
  const byRoom = data.rental_type === "by_room";
  const body = {
    name: data.name,
    address: data.address ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    zip: data.zip ?? "",
    rental_type: byRoom ? "by_room" : "whole",
    rent: byRoom ? 0 : Number(data.rent) || 0,
    deposit: byRoom ? 0 : Number(data.deposit) || 0,
  };

  const property = id
    ? await api.update("properties", id, body)
    : await api.create("properties", { ...body, status: "vacant", listed: false, archived: false });

  // Rooms, if asked for. Numbering carries on from whatever is already there so
  // adding two more to a five-room house gives Room 6 and Room 7.
  const wanted = Math.max(0, Math.min(20, Number(data.room_count) || 0));
  if (byRoom && wanted > 0) {
    const existing = (await api.list("units")).filter((u) => u.property === property.id);
    for (let i = 0; i < wanted; i++) {
      await api.create("units", {
        property: property.id,
        name: `Room ${existing.length + i + 1}`,
        rent: Number(data.room_rent) || 0,
        deposit: Number(data.room_deposit) || Number(data.room_rent) || 0,
        status: "vacant",
        listed: true,
      });
    }
  }

  // Where the rent lands. One account per property, updated rather than piled up.
  const nickname = (data.account_name ?? "").trim();
  const accounts = (await api.list("bank_accounts")).filter((a) => a.property === property.id);
  const accountBody = {
    name: nickname,
    institution: (data.account_institution ?? "").trim(),
    last4: (data.account_last4 ?? "").replace(/\D/g, "").slice(-4),
    property: property.id,
    kind: "bank",
  };
  if (nickname && accounts[0]) await api.update("bank_accounts", accounts[0].id, accountBody);
  else if (nickname) await api.create("bank_accounts", accountBody);

  return property;
}

export async function saveTenant(id, data) {
  const body = {
    first_name: data.first_name,
    last_name: data.last_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    stage: data.stage || "tenant",
    property: data.property ?? "",
    unit: data.unit ?? "",
    notes: data.notes ?? "",
  };
  const person = id
    ? await api.update("people", id, body)
    : await api.create("people", { ...body, archived: false, portal_token: crypto.randomUUID() });

  // A room with somebody in it is occupied, and so is the house.
  if (body.unit) {
    await api.update("units", body.unit, { status: body.stage === "tenant" ? "occupied" : "vacant" });
  }
  if (body.property && body.stage === "tenant") {
    await api.update("properties", body.property, { status: "occupied" });
  }
  return person;
}

/**
 * What a person is attached to.
 *
 * Somebody added by mistake five minutes ago should vanish completely when you
 * remove them. Somebody with two years of rent behind them must not — those
 * charges are your books, and an applicant record is a required reference that
 * the database will refuse to orphan. So we look before we choose.
 */
export async function personTies(id) {
  const [payments, leases, applications, requests] = await Promise.all([
    api.list("payments"),
    api.list("leases"),
    api.list("applications"),
    api.list("maintenance_requests"),
  ]);
  const ties = {
    payments: payments.filter((p) => p.person === id).length,
    leases: leases.filter((l) => (l.tenants ?? []).includes(id)).length,
    applications: applications.filter((a) => a.person === id).length,
    requests: requests.filter((r) => r.person === id).length,
  };
  ties.total = ties.payments + ties.leases + ties.applications + ties.requests;
  return ties;
}

/** Removes a person: gone for good if they have no history, archived if they do. */
export async function removePerson(id, ties) {
  const person = await api.one("people", id);
  if (person?.unit) await api.update("units", person.unit, { status: "vacant" });

  if (ties.total === 0) {
    await api.remove("people", id);
    return "deleted";
  }

  // The room is freed so somebody else can move in, but which house they were
  // in is kept: it is how last year's rent stays attached to the house that
  // earned it. "Past" is what stops them showing up as a current resident.
  await api.update("people", id, { archived: true, stage: "past", unit: "" });
  return "archived";
}

export async function scheduleRent(data) {
  const months = Math.max(1, Math.min(24, Number(data.months) || 1));
  const person = await api.one("people", data.person);
  const leases = await api.list("leases");
  const lease = leases.find((l) => (l.tenants ?? []).includes(data.person) && l.status === "active");

  for (let i = 0; i < months; i++) {
    const due = new Date(`${data.due_date}T00:00:00`);
    due.setMonth(due.getMonth() + i);
    await api.create("payments", {
      lease: lease?.id ?? "",
      person: data.person,
      amount: Number(data.amount) || 0,
      type: data.type || "rent",
      due_date: due.toISOString().slice(0, 10),
      status: "unpaid",
    });
  }
  return person;
}

/* ---------------- saving the newer forms ---------------- */

/**
 * Saves a charge, keeping the books in step.
 *
 * Marking a charge paid books income; taking it back off paid removes that
 * income again. Skipping the second half is how a landlord ends up with a month
 * that shows rent they never received.
 */
export async function savePayment(id, data) {
  const before = await api.one("payments", id);
  const wasPaid = before?.status === "paid";
  const nowPaid = data.status === "paid";

  const charge = await api.update("payments", id, {
    person: data.person ?? "",
    amount: Number(data.amount) || 0,
    due_date: data.due_date ?? "",
    type: data.type || "rent",
    status: data.status || "unpaid",
    method: data.method ?? "",
    paid_date: nowPaid ? data.paid_date || new Date().toISOString().slice(0, 10) : "",
    notes: data.notes ?? "",
  });

  const booked = (await api.list("transactions")).filter((t) => t.payment === id);

  if (nowPaid) {
    const lease = charge.lease ? await api.one("leases", charge.lease) : null;
    const person = charge.person ? await api.one("people", charge.person) : null;
    const body = {
      property: lease?.property || person?.property || "",
      date: charge.paid_date,
      type: "income",
      category: charge.type || "rent",
      amount: charge.amount,
      description: charge.method ? `${titleCase(charge.type || "rent")} — ${methodName(charge.method)}` : titleCase(charge.type || "rent"),
      payment: id,
    };
    // One income record per charge, updated rather than added to, so editing an
    // amount twice doesn't count it twice.
    if (booked[0]) await api.update("transactions", booked[0].id, body);
    else await api.create("transactions", body);
    for (const extra of booked.slice(1)) await api.remove("transactions", extra.id);
  } else if (wasPaid || booked.length > 0) {
    for (const t of booked) await api.remove("transactions", t.id);
  }

  return charge;
}

function methodName(value) {
  return METHODS.find(([key]) => key === value)?.[1] ?? "Other";
}

/** Deletes a charge and any income it booked. */
export async function deletePayment(id) {
  const booked = (await api.list("transactions")).filter((t) => t.payment === id);
  for (const t of booked) await api.remove("transactions", t.id);
  await api.remove("payments", id);
}

export async function saveLease(id, data) {
  const tenants = Object.keys(data)
    .filter((key) => key.startsWith("tenant-") && data[key] === "on")
    .map((key) => key.slice("tenant-".length));

  const body = {
    property: data.property,
    unit: data.unit ?? "",
    tenants,
    start_date: data.start_date ?? "",
    end_date: data.end_date ?? "",
    rent: Number(data.rent) || 0,
    deposit: Number(data.deposit) || 0,
    status: data.status || "active",
  };
  const lease = id ? await api.update("leases", id, body) : await api.create("leases", body);

  // A signed lease means somebody lives there; keep the property and room in step.
  if (body.status === "active" || body.status === "signed") {
    if (body.property) await api.update("properties", body.property, { status: "occupied" });
    if (body.unit) await api.update("units", body.unit, { status: "occupied" });
  }
  return lease;
}

/**
 * Takes one person off a lease, leaving the lease itself alone.
 *
 * The lease is the agreement the rent was charged under, and the other tenants
 * are still on it. Deleting it to remove one person would take the terms of
 * every charge already made with it.
 */
export async function leaveLease(leaseId, personId) {
  const lease = await api.one("leases", leaseId);
  if (!lease) return null;
  const tenants = (lease.tenants ?? []).filter((t) => t !== personId);
  return api.update("leases", leaseId, { tenants });
}

export { CATEGORIES };
