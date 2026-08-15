/**
 * Bank statements in, bookkeeping out.
 *
 * Accounts come first, because that is how the paperwork arrives: you download
 * one statement per account per month. Each account is its own folder — open
 * it, drop the statement in, and everything in it is filed against that
 * account.
 *
 * The screen after that is a review, not a save. Nothing is written until you
 * say so, every decision is a dropdown, and a row already imported turns up
 * unticked.
 */

import * as api from "./api.js";
import { esc, money, moneyExact, shortDate, sumBy, titleCase } from "./lib.js";
import {
  CATEGORIES,
  METHODS,
  applyRules,
  categoryLabel,
  detectAccount,
  fingerprint,
  matchDeposits,
  methodLabel,
  parseStatement,
  suggestCategory,
  suggestMethod,
  vendorKey,
} from "./statements.js";

/**
 * The statement being reviewed.
 *
 * Held in memory rather than the database because nothing has been decided yet
 * — leaving the screen throws it away, which is the right outcome for a
 * half-sorted statement.
 */
let review = null;

export function clearReview() {
  review = null;
}

/* ---------------- the accounts list ---------------- */

export async function screenBank() {
  if (review) return renderReview();

  const [accounts, properties, imports, rules] = await Promise.all([
    api.list("bank_accounts"),
    api.list("properties"),
    api.list("bank_imports"),
    api.list("vendor_rules", { sort: "-uses" }),
  ]);
  const live = properties.filter((p) => !p.archived);
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));

  return (
    `<div class="page-head">
      <div>
        <h1>Bank</h1>
        <p class="sub">One folder per account. Open one to bring in its statement.</p>
      </div>
      <a class="btn" href="#/bank/new">+ Add an account</a>
    </div>` +

    (accounts.length === 0
      ? `<div class="card empty">
          No accounts yet. Add the one your rent lands in, and any you pay bills from.
          <div style="margin-top:.85rem"><a class="btn" href="#/bank/new">+ Add an account</a></div>
        </div>`
      : `<div class="grid grid-sm-2 grid-xl-3" style="margin-bottom:1.5rem">${accounts
          .map((a) => {
            const rows = imports.filter((i) => i.account === a.id);
            const last = rows
              .map((r) => r.posted_date)
              .filter(Boolean)
              .sort()
              .pop();
            return `
          <a class="folder" href="#/bank/${esc(a.id)}">
            <div class="folder-top">
              <span class="folder-mark">▤</span>
              <span class="tag">${esc(titleCase(a.kind || "bank"))}</span>
            </div>
            <div class="folder-name">${esc(a.name)}</div>
            <div class="folder-sub">
              ${esc(a.institution || "No bank named")}${a.last4 ? ` · ····${esc(a.last4)}` : ""}
            </div>
            <div class="folder-foot">
              ${rows.length} row${rows.length === 1 ? "" : "s"} imported${last ? ` · to ${esc(shortDate(last))}` : ""}
              ${a.property ? `<span class="small muted"> · ${esc(nameOf.get(a.property) || "")}</span>` : ""}
            </div>
          </a>`;
          })
          .join("")}</div>`) +

    ruleSection(rules, live)
  );
}

/**
 * The rules the landlord has taught it.
 *
 * Editable as a list rather than buried in the import flow, because the moment
 * you want to change one is the moment a rule sorted something wrongly — and
 * you want to find it, not re-import a statement to reach it.
 */
function ruleSection(rules, properties) {
  return `
    <section class="card">
      <div class="card-head">
        <h2>What your vendors are</h2>
        <p class="small muted" style="margin-top:.25rem">
          A statement says the same thing every month. Teach it once and every
          import after sorts itself. Your rules always beat the built-in guesses.
        </p>
      </div>

      <form data-form="rule" class="card-body" style="border-bottom:1px solid var(--line-soft)">
        <div class="rulerow">
          <div class="field" style="margin:0">
            <label for="r-match">When a statement line contains</label>
            <input id="r-match" name="match" placeholder="duke energy" required />
          </div>
          <div class="field" style="margin:0">
            <label for="r-category">it is</label>
            <select id="r-category" name="category">
              ${CATEGORIES.map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("")}
              <option value="rent">Rent coming in</option>
            </select>
          </div>
          <div class="field" style="margin:0">
            <label for="r-property">for</label>
            <select id="r-property" name="property">
              <option value="">Ask me each time</option>
              ${properties.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}
            </select>
          </div>
          <button class="btn" type="submit">Remember it</button>
        </div>
        <span class="small muted" data-role="status"></span>
      </form>

      ${rules.length === 0
        ? `<div class="empty">Nothing taught yet. Add one above, or tick "remember this" while checking a statement.</div>`
        : `<ul class="rows">${rules
            .map(
              (rule) => `
          <li>
            <div style="min-width:0">
              <div class="t">“${esc(rule.match)}”</div>
              <div class="s">
                → ${esc(rule.category === "rent" ? "Rent coming in" : categoryLabel(rule.category))}
                ${rule.property ? ` · ${esc(properties.find((p) => p.id === rule.property)?.name || "a property")}` : " · you choose the property"}
                ${rule.uses ? ` · used ${rule.uses} time${rule.uses === 1 ? "" : "s"}` : " · not used yet"}
              </div>
            </div>
            <button class="btn-secondary" data-action="delete-rule" data-id="${esc(rule.id)}" data-name="${esc(rule.match)}"
              style="color:var(--out);border-color:#f3c7c0">Forget</button>
          </li>`
            )
            .join("")}</ul>`}
    </section>`;
}

/* ---------------- one account ---------------- */

export async function screenAccount(id) {
  if (review) return renderReview();

  const [account, properties, imports, transactions] = await Promise.all([
    api.one("bank_accounts", id),
    api.list("properties"),
    api.list("bank_imports", { sort: "-posted_date" }),
    api.list("transactions"),
  ]);
  if (!account) return `<div class="card empty">That account no longer exists.</div>`;

  const live = properties.filter((p) => !p.archived);
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));
  const rows = imports.filter((i) => i.account === id);
  const booked = new Set(transactions.map((t) => t.bank_import).filter(Boolean));
  const inflow = sumBy(rows.filter((r) => r.amount > 0), (r) => r.amount);
  const outflow = Math.abs(sumBy(rows.filter((r) => r.amount < 0), (r) => r.amount));

  return (
    `<a href="#/bank" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Bank</a>` +
    `<div class="page-head">
      <div>
        <h1>${esc(account.name)}</h1>
        <p class="sub">
          ${esc(account.institution || "No bank named")}${account.last4 ? ` · ····${esc(account.last4)}` : ""}
          ${account.property ? ` · ${esc(nameOf.get(account.property) || "")}` : ""}
        </p>
      </div>
      <a class="btn-secondary" href="#/bank/${esc(id)}/edit">Edit account</a>
    </div>` +

    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${tile("Rows imported", rows.length)}
      ${tile("Money in", money(inflow), "across every statement", "good")}
      ${tile("Money out", money(outflow), "across every statement", "bad")}
      ${tile("Opening balance", account.opening_balance ? money(account.opening_balance) : "—", account.balance_date ? `as at ${shortDate(account.balance_date)}` : "not set")}
    </div>` +

    `<form data-form="statement" data-account="${esc(id)}" class="card card-body" style="margin-bottom:1.25rem">
      <h2>Bring in a statement</h2>
      <p class="small muted" style="margin-top:.25rem">
        Everything in this file is filed against <strong>${esc(account.name)}</strong>.
        It is read in this browser — the file is never uploaded anywhere.
      </p>

      <div class="field" style="margin-top:1rem">
        <label for="s-property">Which property are these bills for?</label>
        <select id="s-property" name="property">
          <option value="">${account.property ? esc(nameOf.get(account.property) || "This account's property") : "Ask me per row"}</option>
          ${live.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}
        </select>
        <p class="small muted" style="margin-top:.35rem">
          A bill is for the whole house, so this fills in every row at once. Your
          rules override it, and you can change any row on the next screen.
        </p>
      </div>

      <label class="drop" for="s-file" data-role="drop">
        <input id="s-file" name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden />
        <span class="drop-t">Drop this account's statement here</span>
        <span class="drop-s">or click to choose one · CSV, TSV or TXT</span>
        <span class="drop-name small" data-role="filename"></span>
      </label>

      <div class="field" style="margin-top:1rem">
        <label for="s-text">Or paste it</label>
        <textarea id="s-text" name="text" rows="5"
          placeholder="08/01/2026  ZELLE FROM MARCUS WEBB  925.00&#10;08/03/2026  DUKE ENERGY  -142.55"></textarea>
      </div>

      <div style="margin-top:1.25rem;display:flex;gap:.6rem;align-items:center">
        <button class="btn" type="submit">Read the statement</button>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>` +

    (rows.length === 0
      ? `<div class="card empty">Nothing imported into this account yet.</div>`
      : `<section class="card">
          <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem">
            <h2>What's come through</h2>
            <span class="small muted">${rows.length} row${rows.length === 1 ? "" : "s"}, newest first</span>
          </div>
          <ul class="rows">${rows
            .slice(0, 40)
            .map(
              (row) => `
            <li>
              <div style="min-width:0">
                <div class="t">${esc(row.description || "No description")}</div>
                <div class="s">${esc(shortDate(row.posted_date))}${booked.has(row.id) ? " · in your books" : ""}</div>
              </div>
              <span style="font-weight:600;color:${row.amount < 0 ? "var(--out)" : "var(--in)"}">
                ${row.amount < 0 ? "−" : "+"}${esc(moneyExact(Math.abs(row.amount)))}
              </span>
            </li>`
            )
            .join("")}</ul>
        </section>`)
  );
}

/** Add or edit an account. */
export async function accountForm(id) {
  const account = id ? await api.one("bank_accounts", id) : null;
  if (id && !account) return `<div class="card empty">That account no longer exists.</div>`;

  const properties = (await api.list("properties")).filter((p) => !p.archived);
  const kinds = ["bank", "savings", "credit card", "cash"];
  const back = id ? `#/bank/${esc(id)}` : "#/bank";

  return (
    `<a href="${back}" class="small" style="color:var(--brand-600);display:inline-block;margin-bottom:.75rem">← Back</a>` +
    `<div class="page-head"><div><h1>${id ? "Edit account" : "Add an account"}</h1>
      <p class="sub">A folder for one bank account's statements.</p></div></div>` +
    `<form data-form="account" ${id ? `data-id="${esc(id)}"` : ""} class="card card-body" style="max-width:38rem">
      <div class="field">
        <label for="f-name">What do you call it?</label>
        <input id="f-name" name="name" value="${esc(account?.name ?? "")}" required placeholder="SoFi checking" />
      </div>
      <div class="grid grid-sm-2" style="gap:.85rem">
        <div class="field" style="margin:0">
          <label for="f-institution">Bank</label>
          <input id="f-institution" name="institution" value="${esc(account?.institution ?? "")}" placeholder="SoFi" />
        </div>
        <div class="field" style="margin:0">
          <label for="f-last4">Last 4 digits</label>
          <input id="f-last4" name="last4" value="${esc(account?.last4 ?? "")}" inputmode="numeric" maxlength="4" placeholder="4821" />
        </div>
      </div>
      <p class="small muted" style="margin-top:.5rem">
        Never enter a full account number. The last four are what a statement prints,
        and they are all OpenTenant needs to tell your accounts apart.
      </p>

      <div class="grid grid-sm-2" style="gap:.85rem;margin-top:.85rem">
        <div class="field" style="margin:0">
          <label for="f-kind">Kind</label>
          <select id="f-kind" name="kind">
            ${kinds.map((k) => `<option value="${k}"${(account?.kind ?? "bank") === k ? " selected" : ""}>${titleCase(k)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="margin:0">
          <label for="f-property">Mostly for which property?</label>
          <select id="f-property" name="property">
            <option value="">All of them</option>
            ${properties
              .map((p) => `<option value="${esc(p.id)}"${account?.property === p.id ? " selected" : ""}>${esc(p.name)}</option>`)
              .join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-sm-2" style="gap:.85rem;margin-top:.85rem">
        <div class="field" style="margin:0">
          <label for="f-opening_balance">Opening balance ($)</label>
          <input id="f-opening_balance" name="opening_balance" type="number" step="0.01"
            value="${esc(account?.opening_balance ?? "")}" />
        </div>
        <div class="field" style="margin:0">
          <label for="f-balance_date">As at</label>
          <input id="f-balance_date" name="balance_date" type="date" value="${esc(account?.balance_date ?? "")}" />
        </div>
      </div>

      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        <button class="btn" type="submit">${id ? "Save account" : "Add account"}</button>
        <a class="btn-secondary" href="${back}">Cancel</a>
        ${id
          ? `<button type="button" class="btn-secondary" data-action="delete-account"
               data-id="${esc(id)}" data-name="${esc(account.name)}"
               style="margin-left:auto;color:var(--out);border-color:#f3c7c0">Remove account</button>`
          : ""}
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`
  );
}

export async function saveAccount(id, data) {
  const body = {
    name: data.name,
    institution: data.institution ?? "",
    last4: String(data.last4 ?? "").replace(/\D/g, "").slice(-4),
    kind: data.kind || "bank",
    property: data.property ?? "",
    opening_balance: Number(data.opening_balance) || 0,
    balance_date: data.balance_date ?? "",
  };
  return id ? api.update("bank_accounts", id, body) : api.create("bank_accounts", body);
}

/* ---------------- reading a statement ---------------- */

export async function readStatement({ text, accountId, propertyId }) {
  const rows = parseStatement(text);
  if (rows.length === 0) {
    throw new Error(
      "Nothing in there looked like transactions. A CSV export from your bank works best — or paste lines that start with a date and end with an amount."
    );
  }

  const [accounts, imports, people, payments, properties, rules] = await Promise.all([
    api.list("bank_accounts"),
    api.list("bank_imports"),
    api.list("people"),
    api.list("payments"),
    api.list("properties"),
    api.list("vendor_rules"),
  ]);

  // Which account? Opening a folder decides it; otherwise read it off the
  // statement and say what we concluded, so a wrong guess is visible.
  let account = accountId ? accounts.find((a) => a.id === accountId) ?? null : null;
  let reason = account ? "this is its folder" : "";
  if (!account) {
    const guess = detectAccount(text, accounts);
    if (guess) {
      account = accounts.find((a) => a.id === guess.id) ?? null;
      reason = guess.reason;
    }
  }

  // A statement you have already imported should not book everything twice.
  const seen = new Set(imports.map((i) => i.fingerprint).filter(Boolean));
  const known = (row) => seen.has(fingerprint(account?.id ?? "", row));

  const charges = payments.filter((p) => p.status !== "paid");
  const matched = matchDeposits(rows, charges, people);
  const nameOf = new Map(people.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
  const fallbackProperty = propertyId || account?.property || "";

  review = {
    accountId: account?.id ?? "",
    accountName: account ? `${account.name}${account.last4 ? ` ····${account.last4}` : ""}` : "",
    reason,
    properties: properties.filter((p) => !p.archived),
    charges,
    nameOf,
    rows: matched.map(({ row, charge }, index) => {
      const rule = applyRules(row.description, rules);
      const expense = row.amount < 0;
      return {
        index,
        ...row,
        duplicate: known(row),
        kind: expense ? "expense" : "income",
        // A rule the landlord wrote wins over anything we guessed.
        category: rule ? rule.category : expense ? suggestCategory(row.description) : "rent",
        ruleId: rule?.id ?? "",
        vendor: vendorKey(row.description),
        method: suggestMethod(row.description),
        property: rule?.property || fallbackProperty,
        charge: charge?.id ?? "",
      };
    }),
  };
  return review;
}

function tile(label, value, hint = "", tone = "") {
  return `
    <div class="card stat">
      <div class="k">${esc(label)}</div>
      <div class="v ${tone}">${esc(value)}</div>
      ${hint ? `<div class="h">${esc(hint)}</div>` : ""}
    </div>`;
}

function renderReview() {
  const bills = review.rows.filter((r) => r.kind === "expense");
  const moneyIn = review.rows.filter((r) => r.kind === "income");
  const duplicates = review.rows.filter((r) => r.duplicate);
  const matchedCount = moneyIn.filter((r) => r.charge).length;
  const byRule = review.rows.filter((r) => r.ruleId).length;

  const row = (r) => {
    const positive = r.amount >= 0;
    return `
      <div class="imported${r.duplicate ? " dup" : ""}">
        <label class="pick">
          <input type="checkbox" name="use-${r.index}" ${r.duplicate ? "" : "checked"} />
          <span class="sr">Import this row</span>
        </label>
        <div class="what">
          <div class="t">${esc(r.description || "No description")}</div>
          <div class="s">
            ${esc(shortDate(r.posted_date))}
            ${r.duplicate ? ' · <span style="color:var(--warn-ink)">already imported</span>' : ""}
            ${r.ruleId ? ' · <span style="color:var(--good-ink)">your rule</span>' : ""}
          </div>
        </div>
        <div class="amt" style="color:${positive ? "var(--in)" : "var(--out)"}">
          ${positive ? "+" : "−"}${esc(moneyExact(Math.abs(r.amount)))}
        </div>
        <div class="sort">
          ${positive
            ? `<select name="charge-${r.index}" aria-label="Whose payment is this?">
                 <option value="">Not a tenant payment</option>
                 ${review.charges
                   .map(
                     (c) =>
                       `<option value="${esc(c.id)}"${c.id === r.charge ? " selected" : ""}>${esc(
                         review.nameOf.get(c.person) || "Someone"
                       )} — ${esc(moneyExact(c.amount))} due ${esc(shortDate(c.due_date))}</option>`
                   )
                   .join("")}
               </select>
               <select name="method-${r.index}" aria-label="How did it arrive?">
                 ${METHODS.map(
                   ([key, label]) => `<option value="${key}"${key === r.method ? " selected" : ""}>${esc(label)}</option>`
                 ).join("")}
               </select>`
            : `<select name="category-${r.index}" aria-label="What kind of bill?">
                 ${CATEGORIES.map(
                   ([key, label]) => `<option value="${key}"${key === r.category ? " selected" : ""}>${esc(label)}</option>`
                 ).join("")}
               </select>
               <select name="property-${r.index}" aria-label="Which property?">
                 <option value="">No property</option>
                 ${review.properties
                   .map(
                     (p) => `<option value="${esc(p.id)}"${p.id === r.property ? " selected" : ""}>${esc(p.name)}</option>`
                   )
                   .join("")}
               </select>`}
        </div>
        ${!positive && r.vendor && !r.ruleId
          ? `<label class="learn">
              <input type="checkbox" name="learn-${r.index}" />
              <span>Always sort <strong>${esc(r.vendor)}</strong> this way</span>
            </label>`
          : ""}
      </div>`;
  };

  return (
    `<div class="page-head">
      <div>
        <h1>Check the statement</h1>
        <p class="sub">Nothing is saved until you book it. Change anything that looks wrong.</p>
      </div>
      <button class="btn-secondary" data-action="cancel-import" type="button">Start over</button>
    </div>` +
    (review.accountName
      ? `<p class="note good" style="margin-bottom:1.25rem">
          Filing into <strong>${esc(review.accountName)}</strong>${review.reason ? ` — ${esc(review.reason)}` : ""}.
        </p>`
      : `<p class="note warn" style="margin-bottom:1.25rem">
          Couldn't tell which account this is. It still imports; it just won't be
          filed under one.
        </p>`) +
    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${tile("Rows found", review.rows.length, byRule ? `${byRule} sorted by your rules` : "")}
      ${tile("Money in", money(sumBy(moneyIn, (r) => r.amount)), `${matchedCount} matched to a tenant`, "good")}
      ${tile("Bills", money(Math.abs(sumBy(bills, (r) => r.amount))), `${bills.length} withdrawal${bills.length === 1 ? "" : "s"}`, "bad")}
      ${tile("Already imported", duplicates.length, duplicates.length ? "unticked below" : "nothing repeated")}
    </div>` +
    `<form data-form="book">
      ${moneyIn.length > 0
        ? `<section class="card" style="margin-bottom:1.25rem">
            <div class="card-head"><h2>Money coming in</h2></div>
            <div class="importlist">${moneyIn.map(row).join("")}</div>
          </section>`
        : ""}
      ${bills.length > 0
        ? `<section class="card">
            <div class="card-head"><h2>Bills going out</h2></div>
            <div class="importlist">${bills.map(row).join("")}</div>
          </section>`
        : ""}
      <div style="margin-top:1.5rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
        <button class="btn" type="submit">Book these</button>
        <button class="btn-secondary" data-action="cancel-import" type="button">Cancel</button>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`
  );
}

/**
 * Writes the reviewed statement into the books.
 *
 * Every kept row becomes a bank_imports record — that is what stops the same
 * statement being booked twice next month. A bill becomes an expense. A tenant
 * payment marks the charge paid, records how it arrived, and books the income,
 * exactly as ticking "Mark paid" by hand does.
 */
export async function bookStatement(data) {
  const chosen = review.rows.filter((r) => data[`use-${r.index}`] === "on");
  const rules = await api.list("vendor_rules");
  let bills = 0;
  let payments = 0;
  let learned = 0;

  for (const r of chosen) {
    const chargeId = r.amount >= 0 ? String(data[`charge-${r.index}`] || "") : "";
    const imported = await api.create("bank_imports", {
      account: review.accountId,
      posted_date: r.posted_date,
      description: r.description,
      amount: r.amount,
      source: "statement",
      status: "booked",
      payment: chargeId,
      fingerprint: fingerprint(review.accountId, r),
      hidden: false,
    });

    if (r.amount < 0) {
      const category = String(data[`category-${r.index}`] || "other");
      const property = String(data[`property-${r.index}`] || "");
      await api.create("transactions", {
        property,
        date: r.posted_date,
        type: "expense",
        category,
        amount: Math.abs(r.amount),
        description: r.description || categoryLabel(category),
        bank_import: imported.id,
      });
      bills++;

      // "Always sort this vendor this way" — written from the row as booked, so
      // a category changed by hand is what gets remembered, not what we guessed.
      if (data[`learn-${r.index}`] === "on" && r.vendor) {
        const already = rules.find((rule) => rule.match === r.vendor);
        if (already) await api.update("vendor_rules", already.id, { category, property });
        else {
          await api.create("vendor_rules", { match: r.vendor, category, property, direction: "expense", uses: 0 });
          learned++;
        }
      }
      if (r.ruleId) {
        const rule = rules.find((x) => x.id === r.ruleId);
        if (rule) await api.update("vendor_rules", rule.id, { uses: (Number(rule.uses) || 0) + 1 });
      }
      continue;
    }

    const method = String(data[`method-${r.index}`] || "bank");

    if (!chargeId) {
      // Money in that isn't a tenant's rent is still income — a returned
      // deposit, an insurance payout. It goes in the books unattached rather
      // than being dropped.
      await api.create("transactions", {
        property: String(data[`property-${r.index}`] || ""),
        date: r.posted_date,
        type: "income",
        category: "other",
        amount: r.amount,
        description: r.description || "Money in",
        bank_import: imported.id,
      });
      continue;
    }

    const charge = await api.one("payments", chargeId);
    await api.update("payments", chargeId, { status: "paid", paid_date: r.posted_date, method });
    const lease = charge?.lease ? await api.one("leases", charge.lease) : null;
    const person = charge?.person ? await api.one("people", charge.person) : null;
    await api.create("transactions", {
      property: lease?.property || person?.property || "",
      date: r.posted_date,
      type: "income",
      category: charge?.type || "rent",
      amount: Number(charge?.amount) || r.amount,
      description: `${titleCase(charge?.type || "rent")} — ${methodLabel(method)}`,
      payment: chargeId,
      bank_import: imported.id,
    });
    payments++;
  }

  review = null;
  return { bills, payments, learned, total: chosen.length };
}
