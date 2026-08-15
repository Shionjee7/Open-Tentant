/**
 * Bank statements in, bookkeeping out.
 *
 * The landlord's real workflow is: download the month's statement, and work out
 * which lines were bills and which were tenants paying rent. So that is the
 * screen. Paste or drop a statement, check what OpenTenant worked out, change
 * anything it got wrong, and book the lot in one go.
 *
 * Nothing is written until the review step is submitted, and a row already
 * imported is never booked twice.
 */

import * as api from "./api.js";
import { esc, money, moneyExact, shortDate, sumBy, titleCase } from "./lib.js";
import {
  CATEGORIES,
  METHODS,
  categoryLabel,
  detectAccount,
  fingerprint,
  matchDeposits,
  methodLabel,
  parseStatement,
  suggestCategory,
  suggestMethod,
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

export function hasReview() {
  return review !== null;
}

/* ---------------- the import screen ---------------- */

export async function screenBank() {
  if (review) return renderReview();

  const [accounts, properties, imports, transactions] = await Promise.all([
    api.list("bank_accounts"),
    api.list("properties"),
    api.list("bank_imports", { sort: "-posted_date" }),
    api.list("transactions"),
  ]);
  const live = properties.filter((p) => !p.archived);
  const nameOf = new Map(properties.map((p) => [p.id, p.name]));
  const booked = new Set(imports.filter((i) => transactions.some((t) => t.bank_import === i.id)).map((i) => i.id));

  const head = `
    <div class="page-head">
      <div>
        <h1>Bank</h1>
        <p class="sub">Bring in a statement and sort it into bills and rent.</p>
      </div>
    </div>`;

  const dropZone = `
    <form data-form="statement" class="card card-body">
      <h2>Import a statement</h2>
      <p class="small muted" style="margin-top:.25rem">
        Download the CSV from your bank and drop it here, or paste the text
        straight out of a PDF. It is read in this browser — the file is never
        uploaded anywhere.
      </p>

      <div class="field" style="margin-top:1rem">
        <label for="s-account">Which account?</label>
        <select id="s-account" name="account">
          <option value="">Work it out from the statement</option>
          ${accounts
            .map(
              (a) =>
                `<option value="${esc(a.id)}">${esc(a.name)}${a.last4 ? ` ····${esc(a.last4)}` : ""}${
                  a.property ? ` — ${esc(nameOf.get(a.property) || "")}` : ""
                }</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="field">
        <label for="s-property">Which property are these bills for?</label>
        <select id="s-property" name="property">
          <option value="">Ask me per row</option>
          ${live.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}
        </select>
        <p class="small muted" style="margin-top:.35rem">
          A bill is for the whole house, so this fills in every row at once. You
          can still change any of them on the next screen.
        </p>
      </div>

      <label class="drop" for="s-file" data-role="drop">
        <input id="s-file" name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden />
        <span class="drop-t">Drop a statement file here</span>
        <span class="drop-s">or click to choose one · CSV, TSV or TXT</span>
        <span class="drop-name small" data-role="filename"></span>
      </label>

      <div class="field" style="margin-top:1rem">
        <label for="s-text">Or paste the statement</label>
        <textarea id="s-text" name="text" rows="6"
          placeholder="08/01/2026  ZELLE FROM MARCUS WEBB  925.00&#10;08/03/2026  DUKE ENERGY  -142.55"></textarea>
      </div>

      <div style="margin-top:1.25rem;display:flex;gap:.6rem;align-items:center">
        <button class="btn" type="submit">Read the statement</button>
        <span class="small muted" data-role="status"></span>
      </div>
    </form>`;

  const accountList =
    accounts.length === 0
      ? `<div class="card empty">
          No accounts yet. Add one on a property — it's the "Where the rent lands" section of
          <a href="#/properties" style="color:var(--brand-600)">any property</a>.
        </div>`
      : `<section class="card">
          <div class="card-head"><h2>Your accounts</h2></div>
          <ul class="rows">${accounts
            .map(
              (a) => `
            <li>
              <div>
                <div class="t">${esc(a.name)}${a.last4 ? ` <span class="muted small">····${esc(a.last4)}</span>` : ""}</div>
                <div class="s">${esc(a.institution || "No bank named")}${a.property ? ` · ${esc(nameOf.get(a.property) || "")}` : ""}</div>
              </div>
              <span class="small muted">${imports.filter((i) => i.account === a.id).length} rows imported</span>
            </li>`
            )
            .join("")}</ul>
        </section>`;

  const recent =
    imports.length === 0
      ? ""
      : `<section class="card">
          <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem">
            <h2>Already imported</h2>
            <span class="small muted">${imports.length} row${imports.length === 1 ? "" : "s"}, newest first</span>
          </div>
          <ul class="rows">${imports
            .slice(0, 15)
            .map(
              (row) => `
            <li>
              <div style="min-width:0">
                <div class="t">${esc(row.description || "No description")}</div>
                <div class="s">${esc(shortDate(row.posted_date))}${booked.has(row.id) ? " · booked" : " · skipped"}</div>
              </div>
              <span style="font-weight:600;color:${row.amount < 0 ? "var(--out)" : "var(--in)"}">
                ${row.amount < 0 ? "−" : "+"}${esc(moneyExact(Math.abs(row.amount)))}
              </span>
            </li>`
            )
            .join("")}</ul>
        </section>`;

  return head + dropZone + accountList + recent;
}

/**
 * Reads a statement and works out what each line is.
 *
 * Nothing is saved here. The result goes into `review` and the landlord gets a
 * screen showing every decision the app made, each one changeable.
 */
export async function readStatement({ text, accountId, propertyId }) {
  const rows = parseStatement(text);
  if (rows.length === 0) {
    throw new Error(
      "Nothing in there looked like transactions. A CSV export from your bank works best — or paste lines that start with a date and end with an amount."
    );
  }

  const [accounts, imports, people, payments, properties] = await Promise.all([
    api.list("bank_accounts"),
    api.list("bank_imports"),
    api.list("people"),
    api.list("payments"),
    api.list("properties"),
  ]);

  // Which account? What the landlord chose wins; otherwise read it off the
  // statement, and say what we concluded so a wrong guess is visible.
  let account = accountId ? accounts.find((a) => a.id === accountId) ?? null : null;
  let reason = account ? "you picked it" : "";
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

  // A bill defaults to the property the landlord named, then to whichever
  // property the account belongs to.
  const fallbackProperty = propertyId || account?.property || "";

  review = {
    accountId: account?.id ?? "",
    accountName: account ? `${account.name}${account.last4 ? ` ····${account.last4}` : ""}` : "",
    reason,
    people,
    properties: properties.filter((p) => !p.archived),
    charges,
    nameOf,
    rows: matched.map(({ row, charge }, index) => ({
      index,
      ...row,
      duplicate: known(row),
      kind: row.amount < 0 ? "expense" : "income",
      category: row.amount < 0 ? suggestCategory(row.description) : "rent",
      method: suggestMethod(row.description),
      property: fallbackProperty,
      charge: charge?.id ?? "",
      person: charge?.person ?? "",
    })),
  };
  return review;
}

function renderReview() {
  const bills = review.rows.filter((r) => r.kind === "expense");
  const money_in = review.rows.filter((r) => r.kind === "income");
  const duplicates = review.rows.filter((r) => r.duplicate);
  const matchedCount = money_in.filter((r) => r.charge).length;

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
          Read as <strong>${esc(review.accountName)}</strong>${review.reason ? ` — ${esc(review.reason)}` : ""}.
        </p>`
      : `<p class="note warn" style="margin-bottom:1.25rem">
          Couldn't tell which account this is. It still imports; it just won't be
          matched against an account's history.
        </p>`) +
    `<div class="grid grid-2 grid-md-4" style="margin-bottom:1.25rem">
      ${statTile("Rows found", review.rows.length)}
      ${statTile("Money in", money(sumBy(money_in, (r) => r.amount)), `${matchedCount} matched to a tenant`, "good")}
      ${statTile("Bills", money(Math.abs(sumBy(bills, (r) => r.amount))), `${bills.length} withdrawal${bills.length === 1 ? "" : "s"}`, "bad")}
      ${statTile("Already imported", duplicates.length, duplicates.length ? "unticked below" : "nothing repeated")}
    </div>` +
    `<form data-form="book">
      ${money_in.length > 0
        ? `<section class="card" style="margin-bottom:1.25rem">
            <div class="card-head"><h2>Money coming in</h2></div>
            <div class="importlist">${money_in.map(row).join("")}</div>
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

function statTile(label, value, hint = "", tone = "") {
  return `
    <div class="card stat">
      <div class="k">${esc(label)}</div>
      <div class="v ${tone}">${esc(value)}</div>
      ${hint ? `<div class="h">${esc(hint)}</div>` : ""}
    </div>`;
}

/**
 * Writes the reviewed statement into the books.
 *
 * Every row that is kept becomes a bank_imports record — that is what stops the
 * same statement being booked twice next month. A bill becomes an expense. A
 * tenant payment marks the charge paid, records how it arrived, and books the
 * income, which is the same thing that happens when you tick "Mark paid" by
 * hand.
 */
export async function bookStatement(data) {
  const chosen = review.rows.filter((r) => data[`use-${r.index}`] === "on");
  let bills = 0;
  let payments = 0;

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
      await api.create("transactions", {
        property: String(data[`property-${r.index}`] || ""),
        date: r.posted_date,
        type: "expense",
        category,
        amount: Math.abs(r.amount),
        description: r.description || categoryLabel(category),
        bank_import: imported.id,
      });
      bills++;
      continue;
    }

    const method = String(data[`method-${r.index}`] || "bank");

    if (!chargeId) {
      // Money in that isn't a tenant's rent is still income — a deposit
      // returned, an insurance payout. It goes in the books unattached rather
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
    await api.update("payments", chargeId, {
      status: "paid",
      paid_date: r.posted_date,
      method,
    });
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
  return { bills, payments, total: chosen.length };
}
