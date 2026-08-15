import { esc, money, monthLabel } from "./lib.js";

/**
 * The year, one row per month.
 *
 * This was a bar chart, and a bar chart is the wrong tool here. A landlord
 * reading it wanted a number — "what did June actually leave me?" — and got a
 * length to compare against other lengths, plus a caption explaining how to
 * read it. Any figure that needs a key is a figure that has been made harder
 * to read.
 *
 * So it is a table of the three numbers that matter, month by month. Red only
 * where money actually went out the door, and never as the only signal: the
 * minus sign is right there in the figure.
 */
export function renderMonths(rows) {
  const firstActive = rows.findIndex((r) => r.income > 0 || r.expenses > 0);
  if (firstActive === -1) {
    return `<p class="empty">Once rent is marked paid, every month shows up here.</p>`;
  }

  // Months before anything was recorded are blank rows that push the real ones
  // off the screen.
  const shown = rows.slice(firstActive);
  const keys = shown.map((r) => r.month);

  return `
    <div class="ledger">
      <div class="ledger-head">
        <span>Month</span><span>Came in</span><span>Went out</span><span>Kept</span>
      </div>
      ${shown
        .map((row) => {
          const blank = row.income === 0 && row.expenses === 0;
          return `
        <div class="ledger-row${row.current ? " now" : ""}">
          <span class="m">
            ${esc(monthLabel(row.month, keys))}${row.current ? ' <span class="sofar">so far</span>' : ""}
          </span>
          <span class="in">${blank ? "—" : esc(money(row.income))}</span>
          <span class="out">${blank || row.expenses === 0 ? "—" : `−${esc(money(row.expenses))}`}</span>
          <span class="net ${row.net < 0 ? "bad" : ""}">${blank ? "—" : esc(money(row.net))}</span>
        </div>`;
        })
        .join("")}
    </div>`;
}
