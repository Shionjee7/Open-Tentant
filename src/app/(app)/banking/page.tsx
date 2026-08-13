import {
  accountBalances,
  listBankAccounts,
  listBankImports,
  listProperties,
  openPayments,
} from "@/lib/data";
import {
  bookImportAsExpense,
  bookImportAsIncome,
  clearImports,
  confirmDuplicate,
  createBankAccount,
  deleteBankAccount,
  ignoreImport,
  importStatement,
  matchImport,
  setAccountBalance,
  unignoreImport,
} from "@/lib/actions";
import { matchScore, suggestCategory } from "@/lib/statements";
import { moneyExact, shortDate, titleCase } from "@/lib/format";
import { Badge, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Bank deposits" };

/** Same list the manual expense form offers, so the books stay consistent. */
const EXPENSE_CATEGORIES: [string, string][] = [
  ["repairs", "Repairs"],
  ["utilities", "Utilities"],
  ["insurance", "Insurance"],
  ["taxes", "Taxes"],
  ["mortgage", "Mortgage"],
  ["turnover", "Turnover"],
  ["software", "Software"],
  ["other", "Other"],
];

const KINDS = [
  ["bank", "Bank account"],
  ["zelle", "Zelle"],
  ["cashapp", "Cash App"],
  ["venmo", "Venmo"],
  ["paypal", "PayPal"],
  ["other", "Other"],
];

export default async function BankingPage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    skipped?: string;
    error?: string;
    duplicates?: string;
    expenses?: string;
    account?: string;
  }>;
}) {
  const { imported, skipped, error, duplicates, expenses, account } = await searchParams;
  const accounts = await listBankAccounts();
  const balances = await accountBalances();
  const today = new Date().toISOString().slice(0, 10);
  const properties = await listProperties();
  const unmatched = await listBankImports("unmatched");
  const matched = await listBankImports("matched");
  const ignored = await listBankImports("ignored");
  const alreadyRecorded = await listBankImports("already_recorded");
  const expenseReview = await listBankImports("expense_review");
  const candidates = await openPayments();

  const unmatchedTotal = unmatched.reduce((sum, d) => sum + d.amount, 0);
  // Nothing set up and nothing imported: the tiles would all read zero and the
  // review list would be empty, so lead with the two forms that change that.
  const started = accounts.length > 0 || matched.length + unmatched.length + ignored.length > 0;

  return (
    <>
      <PageHeader
        title="Bank deposits"
        subtitle="Track which account each property's rent lands in, then import a statement and assign each deposit to the tenant who paid."
      />

      {(imported || error) && (
        <div
          className={`card mb-5 px-4 py-3 text-sm ${
            error ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error === "empty" && "Nothing to import — paste your statement text or choose a file."}
          {error === "unparsed" &&
            "Couldn't find any transactions in that. Export as CSV from your bank, or paste lines that include a date and an amount."}
          {imported && (
            <>
              Imported <strong>{imported}</strong> transaction{imported === "1" ? "" : "s"}
              {expenses && Number(expenses) > 0 && ` · ${expenses} of them money going out`}
              {skipped && Number(skipped) > 0 && ` · skipped ${skipped} (already imported)`}
              {duplicates && Number(duplicates) > 0 &&
                ` · ${duplicates} look like money already on the books, so we've asked below`}.
              {account && (
                <div className="mt-1">
                  Filed under <strong>{account.split(" — ")[0]}</strong> — {account.split(" — ")[1]}.
                  Wrong? Pick the account by hand next time.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {started && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Accounts" value={accounts.length} />
          <StatCard label="Needs review" value={unmatched.length} tone={unmatched.length > 0 ? "bad" : "default"} />
          <StatCard label="Unassigned total" value={moneyExact(unmatchedTotal)} />
          <StatCard label="Assigned" value={matched.length} tone="good" />
        </div>
      )}

      {!started && (
        <div className="card mb-6 border-brand-100 bg-brand-50/60 px-5 py-4 text-sm text-ink-700">
          <strong className="text-ink-900">Two things to do here.</strong> Add the account your rent
          lands in, then export a statement from your bank and drop it in. Deposits get matched to
          tenants and bills get sorted into expense categories — nothing is counted twice.
        </div>
      )}

      {alreadyRecorded.length > 0 && (
        <section className="card mb-6 border-amber-200">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-4">
            <h2 className="font-semibold text-amber-900">
              Is this the same money? ({alreadyRecorded.length})
            </h2>
            <p className="text-xs text-amber-800">
              Each of these looks like a payment you already recorded — usually because the tenant
              reported paying and you approved it. Nothing has been counted twice, and nothing is
              booked until you say. Answer each one so the books are right.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {alreadyRecorded.map((deposit) => (
              <li key={deposit.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {moneyExact(deposit.amount)}
                    </span>
                    <span className="ml-2 text-ink-500">
                      {shortDate(deposit.posted_date)}
                      {deposit.account_name ? ` · ${deposit.account_name}` : ""}
                    </span>
                    <div className="truncate text-xs text-ink-500">{deposit.description}</div>
                    <p className="mt-1.5 text-xs text-ink-700">
                      Looks like{" "}
                      <strong>
                        {deposit.matched_tenant ? `${deposit.matched_tenant}'s payment` : "a payment"}
                      </strong>{" "}
                      you already have on the books
                      {deposit.matched_payment_date
                        ? ` from ${shortDate(deposit.matched_payment_date)}`
                        : ""}
                      .
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <form action={confirmDuplicate}>
                      <input type="hidden" name="id" value={deposit.id} />
                      <button className="btn btn-sm" title="Don't count it again">
                        Yes — same payment
                      </button>
                    </form>
                    <form action={unignoreImport}>
                      <input type="hidden" name="id" value={deposit.id} />
                      <button className="btn-secondary btn-sm" title="Treat this as separate money">
                        No — it&apos;s separate
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Bills paid out ---------------- */}
      {expenseReview.length > 0 && (
        <section className="card mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Money that went out ({expenseReview.length})</h2>
            <p className="text-xs text-ink-500">
              Withdrawals from your statement, with a category guessed from the description. Check
              it and book it, and it lands in Accounting against the right property.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {expenseReview.map((deposit) => (
              <li key={deposit.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-base font-semibold text-rose-600" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {moneyExact(Math.abs(deposit.amount))}
                    </span>
                    <span className="ml-2 text-ink-500">
                      {shortDate(deposit.posted_date)}
                      {deposit.account_name ? ` · ${deposit.account_name}` : ""}
                    </span>
                    <div className="truncate text-ink-700">{deposit.description}</div>
                  </div>
                  <form action={bookImportAsExpense} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={deposit.id} />
                    <div>
                      <label className="label">Category</label>
                      <select
                        name="category"
                        className="input"
                        defaultValue={suggestCategory(deposit.description)}
                      >
                        {EXPENSE_CATEGORIES.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Property</label>
                      <select
                        name="property_id"
                        className="input"
                        defaultValue={
                          accounts.find((a) => a.id === deposit.account)?.property ?? ""
                        }
                      >
                        <option value="">Portfolio-wide</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn btn-sm">Book expense</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 px-5 py-3">
            <form action={clearImports}>
              <input type="hidden" name="status" value="expense_review" />
              <button className="btn-secondary btn-sm">Not expenses — clear these</button>
            </form>
          </div>
        </section>
      )}

      {/* ---------------- Deposits needing review ---------------- */}
      {started && (
      <section className="card mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold">Deposits to review</h2>
            <p className="text-xs text-ink-500">
              We suggest the most likely tenant from the amount, the name in the description, and the due date.
            </p>
          </div>
        </div>

        {unmatched.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-500">
            Nothing waiting. Import a statement below and deposits show up here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {unmatched.map((deposit) => {
              // Rank the open payments against this deposit.
              const ranked = candidates
                .map((payment) => ({
                  payment,
                  score: matchScore(deposit.description, deposit.amount, {
                    tenantName: payment.tenant_name ?? "",
                    amount: payment.amount,
                    dueDate: payment.due_date,
                    postedDate: deposit.posted_date,
                  }),
                }))
                .sort((a, b) => b.score - a.score);
              const best = ranked[0];
              const confident = best && best.score >= 55;

              return (
                <li key={deposit.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {moneyExact(deposit.amount)}
                      </span>
                      <span className="ml-2 text-sm text-ink-500">
                        {shortDate(deposit.posted_date)}
                        {deposit.account_name ? ` · ${deposit.account_name}` : ""}
                        {deposit.source ? ` · ${titleCase(deposit.source)}` : ""}
                      </span>
                      <div className="mt-0.5 truncate text-sm text-ink-700">{deposit.description}</div>
                    </div>
                    {confident && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Likely {best.payment.tenant_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <form action={matchImport} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={deposit.id} />
                      <div>
                        <label className="label">Assign to tenant payment</label>
                        <select
                          name="payment_id"
                          className="input w-80"
                          defaultValue={confident ? best.payment.id : ""}
                        >
                          <option value="">Choose a payment…</option>
                          {ranked.map(({ payment, score }) => (
                            <option key={payment.id} value={payment.id}>
                              {payment.tenant_name ?? "—"} · {moneyExact(payment.amount)} ·{" "}
                              {titleCase(payment.type)} due {shortDate(payment.due_date)}
                              {score >= 55 ? "  ★ best match" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="btn">Mark paid</button>
                    </form>

                    <form action={bookImportAsIncome} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={deposit.id} />
                      <div>
                        <label className="label">…or book as other income</label>
                        <select name="property_id" className="input w-44" defaultValue="">
                          <option value="">Portfolio-wide</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <select name="category" className="input w-32" defaultValue="other">
                        <option value="rent">Rent</option>
                        <option value="deposit">Deposit</option>
                        <option value="other">Other</option>
                      </select>
                      <button className="btn-secondary">Book income</button>
                    </form>

                    <form action={ignoreImport} className="ml-auto">
                      <input type="hidden" name="id" value={deposit.id} />
                      <button className="btn-secondary btn-sm">Not rent — ignore</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---------------- Import ---------------- */}
        <section className="card p-5">
          <h2 className="font-semibold">Import a statement</h2>
          <p className="mt-1 text-xs text-ink-500">
            Export CSV from your bank, Zelle, Cash App, Venmo, or PayPal and upload it — or paste the
            lines straight from a PDF statement. Common formats are detected automatically, and
            importing the same file twice never duplicates anything.
          </p>
          <form action={importStatement} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Into account</label>
                <select name="account_id" className="input" defaultValue="">
                  <option value="">Work it out from the statement</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Source</label>
                <select name="source" className="input" defaultValue="bank">
                  {KINDS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Upload CSV / text file</label>
              <input
                type="file"
                name="statement_file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="input file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"
              />
            </div>
            <div>
              <label className="label">…or paste statement lines</label>
              <textarea
                name="statement_text"
                rows={6}
                className="input font-mono text-xs"
                placeholder={"Date,Description,Amount\n03/01/2026,ZELLE FROM DANA LIU,1250.00"}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="deposits_only" className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                Rent only — ignore money going out
                <span className="block text-xs text-ink-500">
                  Leave this off and withdrawals come in too, sorted into expense categories for
                  you to check.
                </span>
              </span>
            </label>
            <button className="btn w-full justify-center">Import statement</button>
          </form>

          <details className="mt-4 text-xs text-ink-500">
            <summary className="cursor-pointer hover:text-ink-900">
              Can I connect my bank directly instead?
            </summary>
            <p className="mt-2 leading-relaxed">
              Live bank connections run through paid aggregators (Plaid and similar) that charge per
              account per month, so OpenTenant doesn&apos;t require one — statement import does the same
              job for free. Every bank and payment app lets you export CSV, and most let you schedule
              a monthly export by email.
            </p>
          </details>
        </section>

        {/* ---------------- Accounts ---------------- */}
        <section className="card p-5">
          <h2 className="font-semibold">Accounts</h2>
          <p className="mt-1 text-xs text-ink-500">
            Record which account each property&apos;s rent goes into. Never enter full account or routing
            numbers — the last four digits are enough to tell accounts apart.
          </p>

          {balances.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {balances.map(({ account: a, balance, known, depositsIn }) => (
                <li key={a.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {a.name}
                        {a.last4 && <span className="ml-1 text-ink-500">••{a.last4}</span>}
                      </div>
                      <div className="text-xs text-ink-500">
                        {titleCase(a.kind)}
                        {a.institution ? ` · ${a.institution}` : ""}
                        {" · "}
                        {a.property_name ?? "all properties"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {moneyExact(balance)}
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {known ? "balance now" : `${moneyExact(depositsIn)} in`}
                      </div>
                    </div>
                  </div>

                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-900">
                      {known ? "Correct the balance" : "Set the starting balance"}
                    </summary>
                    <form action={setAccountBalance} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <div className="w-28">
                        <label className="label">Balance</label>
                        <input
                          name="opening_balance"
                          type="number"
                          step="0.01"
                          defaultValue={a.opening_balance || ""}
                          className="input"
                        />
                      </div>
                      <div className="w-40">
                        <label className="label">As of</label>
                        <input
                          name="balance_date"
                          type="date"
                          defaultValue={a.balance_date || today}
                          className="input"
                        />
                      </div>
                      <button className="btn-secondary btn-sm">Save</button>
                    </form>
                    <p className="mt-1.5 text-xs text-ink-500">
                      Copy the closing balance from a statement. Deposits imported after that date
                      are added, and expenses on this property are subtracted.
                    </p>
                    <form action={deleteBankAccount} className="mt-2">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn-secondary btn-sm">Remove this account</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}

          <form action={createBankAccount} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nickname</label>
                <input name="name" required className="input" placeholder="Rent checking" />
              </div>
              <div>
                <label className="label">Kind</label>
                <select name="kind" className="input" defaultValue="bank">
                  {KINDS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Institution</label>
                <input name="institution" className="input" placeholder="Chase" />
              </div>
              <div>
                <label className="label">Last 4 digits</label>
                <input name="last4" inputMode="numeric" maxLength={4} className="input" placeholder="4821" />
              </div>
            </div>
            <div>
              <label className="label">Money for which property?</label>
              <select name="property_id" className="input" defaultValue="">
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button className="btn w-full justify-center">Add account</button>
          </form>
        </section>
      </div>

      {/* ---------------- History ---------------- */}
      {(matched.length > 0 || ignored.length > 0) && (
        <section className="card mt-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Already handled</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {[...matched, ...ignored].slice(0, 25).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {moneyExact(d.amount)}
                  </span>
                  <span className="ml-2 text-ink-500">{shortDate(d.posted_date)}</span>
                  <div className="truncate text-xs text-ink-500">{d.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  {d.matched_tenant && <span className="text-xs text-ink-700">{d.matched_tenant}</span>}
                  <Badge value={d.status === "matched" ? "paid" : "cancelled"} label={d.status === "matched" ? "Assigned" : "Ignored"} />
                  {d.status === "ignored" && (
                    <form action={unignoreImport}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn-secondary btn-sm">Undo</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
            {ignored.length > 0 && (
              <form action={clearImports}>
                <input type="hidden" name="status" value="ignored" />
                <button className="btn-secondary btn-sm">Clear ignored ({ignored.length})</button>
              </form>
            )}
            {matched.length > 0 && (
              <form action={clearImports}>
                <input type="hidden" name="status" value="matched" />
                <button className="btn-secondary btn-sm">Clear assigned history ({matched.length})</button>
              </form>
            )}
          </div>
        </section>
      )}
    </>
  );
}
