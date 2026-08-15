import { esc, money, monthLabel } from "./lib.js";

/**
 * The year, one row per month.
 *
 * Two layouts, chosen by the data. All-positive months start at the left and
 * use the full width. As soon as one month costs more than it made, a centre
 * line appears and that month grows left from it, because "which side" then
 * carries meaning that length alone can't.
 *
 * Blue for kept, red for lost — not the usual green/red, which measures ΔE 6.5
 * apart under protanopia and is unreadable for a red-green colourblind reader
 * (blue/red measures 24.7). The amount is written beside every bar, so colour
 * never carries the meaning on its own.
 */

/** Each arm of the diverging layout, as a share of the track. */
const ARM = 50;

export function renderMonths(rows) {
  const firstActive = rows.findIndex((r) => r.income > 0 || r.expenses > 0);
  if (firstActive === -1) {
    return `<p class="empty">Once rent is marked paid, every month shows up here.</p>`;
  }

  // Months before anything was recorded are blank rows that push the real ones
  // off the screen.
  const shown = rows.slice(firstActive);
  const anyLoss = shown.some((r) => r.net < 0);
  const biggest = Math.max(1, ...shown.map((r) => Math.abs(r.net)));
  const keys = shown.map((r) => r.month);

  const bars = shown
    .map((row) => {
      const share = Math.min(100, (Math.abs(row.net) / biggest) * 100);
      const width = anyLoss ? (share * ARM) / 100 : share;
      const up = row.net >= 0;
      const blank = row.income === 0 && row.expenses === 0;

      const track = anyLoss
        ? `<div class="side left">${!up && !blank ? `<span class="bar out" style="width:${width}%"></span>` : ""}</div>
           <span class="zero"></span>
           <div class="side">${up && !blank ? `<span class="bar in" style="width:${width}%"></span>` : ""}</div>`
        : `<div class="side">${up && !blank ? `<span class="bar in" style="width:${width}%"></span>` : ""}</div>`;

      return `
        <li class="${row.current ? "now" : ""}">
          <div class="m">
            ${esc(monthLabel(row.month, keys))}
            ${row.current ? '<span class="sofar">so far</span>' : ""}
          </div>
          <div class="track" aria-hidden="true">${track}</div>
          <div class="right">
            ${blank
              ? '<span class="muted">—</span>'
              : `<div class="amt ${up ? "" : "bad"}">${esc(money(row.net))}</div>
                 <div class="flow">${esc(money(row.income))} in · ${esc(money(row.expenses))} out</div>`}
          </div>
        </li>`;
    })
    .join("");

  return `
    <p class="small muted" style="padding:.75rem 1rem 0">
      ${anyLoss
        ? "Longer bar, better month — all on one scale. Months that cost more than they made run left of the line."
        : "Longer bar, better month — all on one scale."}
    </p>
    <ol class="months">${bars}</ol>`;
}
