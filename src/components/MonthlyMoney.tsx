import { money, monthLabelIn } from "@/lib/format";
import type { MonthRow } from "@/lib/data";

/**
 * The year, one row per month.
 *
 * The job is magnitude with polarity — how much, and which side of the line —
 * so each month is a bar you can compare by length, running your eye down the
 * column. No axis, no legend: the amount is written beside every bar.
 *
 * Two layouts, chosen by the data. If every month is positive the bars start at
 * the left and use the full width. As soon as one month is a loss, a centre
 * line appears and losses grow left from it, because "which side" then carries
 * meaning that length alone can't.
 *
 * Blue for kept, red for lost — not the usual green/red. Green and red measure
 * ΔE 6.5 apart under protanopia, the pair a red-green colourblind reader cannot
 * separate; blue/red measures 24.7. The amount is written out either way, so
 * colour never carries the meaning alone.
 */

/** Each arm of the diverging layout, as a share of the track. */
const ARM = 50;

export default function MonthlyMoney({ rows }: { rows: MonthRow[] }) {
  const active = rows.filter((r) => r.income > 0 || r.expenses > 0);
  if (active.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-500">
        Once rent is approved and bills are imported, every month shows up here.
      </p>
    );
  }

  // Months before anything was recorded are blank rows that push the real ones
  // off the screen. Start at the first month with activity.
  const firstActive = rows.findIndex((r) => r.income > 0 || r.expenses > 0);
  const shown = rows.slice(firstActive);

  const anyLoss = shown.some((r) => r.net < 0);
  const biggest = Math.max(1, ...shown.map((r) => Math.abs(r.net)));
  const labels = shown.map((r) => r.month);

  return (
    <>
      <p className="px-4 pb-2 text-sm text-ink-500 sm:px-5">
        {anyLoss
          ? "Longer bar, better month — all on one scale. Months that cost more than they made run left of the line."
          : "Longer bar, better month — all on one scale."}
      </p>
      <ol className="divide-y divide-slate-100">
      {shown.map((row) => {
        const share = Math.min(100, (Math.abs(row.net) / biggest) * 100);
        const up = row.net >= 0;
        const empty = row.income === 0 && row.expenses === 0;
        const width = `${anyLoss ? (share * ARM) / 100 : share}%`;

        return (
          <li
            key={row.month}
            className={`grid grid-cols-[3.75rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[5rem_1fr_9.5rem] sm:gap-4 sm:px-5 ${
              row.current ? "bg-brand-50/50" : ""
            }`}
          >
            <div className="text-sm">
              <span className={row.current ? "font-semibold" : ""}>
                {monthLabelIn(row.month, labels)}
              </span>
              {row.current && (
                <span className="block text-[10px] uppercase tracking-wide text-ink-500">
                  so far
                </span>
              )}
            </div>

            <div className="flex h-6 items-center" aria-hidden="true">
              {anyLoss && (
                <>
                  <div className="flex h-full flex-1 justify-end">
                    {!up && !empty && (
                      <div
                        className="h-3.5 self-center rounded-l-[3px]"
                        style={{ width, background: "var(--color-out)" }}
                      />
                    )}
                  </div>
                  <div className="h-4 w-px shrink-0 bg-slate-300" />
                </>
              )}
              <div className="flex h-full flex-1">
                {up && !empty && (
                  <div
                    className="h-3.5 self-center rounded-r-[3px]"
                    style={{ width, background: "var(--color-in)" }}
                  />
                )}
              </div>
            </div>

            <div className="text-right">
              {empty ? (
                <span className="text-sm text-slate-400">—</span>
              ) : (
                <>
                  <div className={`text-sm font-semibold ${up ? "text-ink-900" : "text-rose-700"}`}>
                    {money(row.net)}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {money(row.income)} in · {money(row.expenses)} out
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
      </ol>
    </>
  );
}
