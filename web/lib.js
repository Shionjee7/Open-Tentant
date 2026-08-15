/**
 * The small shared pieces: formatting, safe HTML, and the money maths.
 *
 * These are the same rules the app has always used, moved out of the server and
 * into the browser — which is where they can live now that the browser talks to
 * the database directly.
 */

/** Escapes anything that came from a person before it goes into HTML. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function money(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function moneyExact(amount) {
  return (Number(amount) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function shortDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "Aug" normally, "Aug '25" when the list spans more than one year. */
export function monthLabel(ym, all = []) {
  const [y, m] = String(ym).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  const short = date.toLocaleDateString("en-US", { month: "short" });
  const years = new Set(all.map((k) => String(k).slice(0, 4)));
  return years.size > 1 ? `${short} '${String(y).slice(2)}` : short;
}

export function titleCase(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The year, month by month.
 *
 * Income and expenses come from booked transactions; rent due and rent paid
 * come from the schedule, so a month whose money hasn't landed still shows what
 * was owed.
 */
export function monthlyLedger(transactions, payments, months = 12) {
  const now = new Date();
  const thisMonth = monthKey(now);
  const rows = new Map();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    rows.set(key, {
      month: key,
      income: 0,
      expenses: 0,
      net: 0,
      rentDue: 0,
      rentPaid: 0,
      current: key === thisMonth,
    });
  }

  for (const t of transactions) {
    const row = rows.get(String(t.date ?? "").slice(0, 7));
    if (!row) continue;
    if (t.type === "income") row.income += Number(t.amount) || 0;
    else row.expenses += Number(t.amount) || 0;
  }

  for (const p of payments) {
    const row = rows.get(String(p.due_date ?? "").slice(0, 7));
    if (!row) continue;
    row.rentDue += Number(p.amount) || 0;
    if (p.status === "paid") row.rentPaid += Number(p.amount) || 0;
  }

  const ordered = [...rows.values()];
  for (const row of ordered) row.net = row.income - row.expenses;
  return ordered;
}

export function sumBy(items, pick) {
  return items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
}
