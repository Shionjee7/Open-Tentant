"use client";

import { useState } from "react";

type Row = { month: string; label: string; income: number; expenses: number };

const SERIES = [
  { key: "income" as const, label: "Income", color: "#2a78d6" },
  { key: "expenses" as const, label: "Expenses", color: "#eb6834" },
];

const W = 640;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Bar with only the data-end (top) rounded, anchored square to the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

export default function IncomeExpenseChart({ data }: { data: Row[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  const niceMax = Math.ceil(max / 500) * 500;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(28, band * 0.28);
  const gap = 2;
  const y = (v: number) => PAD.top + plotH - (v / niceMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs font-medium text-ink-700">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly income and expenses">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={t === 0 ? 0 : 1} />
            <text x={PAD.left - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#898781" style={{ fontVariantNumeric: "tabular-nums" }}>
              {t >= 1000 ? `$${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}k` : `$${t}`}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth={1} />

        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const x1 = cx - barW - gap / 2;
          const x2 = cx + gap / 2;
          return (
            <g key={d.month}>
              {d.income > 0 && <path d={barPath(x1, y(d.income), barW, y(0) - y(d.income))} fill={SERIES[0].color} />}
              {d.expenses > 0 && <path d={barPath(x2, y(d.expenses), barW, y(0) - y(d.expenses))} fill={SERIES[1].color} />}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#52514e">{d.label}</text>
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill={hover === i ? "rgba(11,11,11,0.04)" : "transparent"}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="font-semibold text-ink-900">{data[hover].label}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="mt-0.5 flex items-center gap-1.5 text-ink-700">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}: <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(data[hover][s.key])}</span>
            </div>
          ))}
          <div className="mt-0.5 border-t border-slate-100 pt-0.5 font-medium text-ink-900">
            Net: {fmt(data[hover].income - data[hover].expenses)}
          </div>
        </div>
      )}

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-ink-500 hover:text-ink-900">View as table</summary>
        <table className="mt-2 w-full max-w-md">
          <thead>
            <tr>
              <th className="th">Month</th>
              <th className="th">Income</th>
              <th className="th">Expenses</th>
              <th className="th">Net</th>
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-slate-100">
                <td className="td">{d.label}</td>
                <td className="td">{fmt(d.income)}</td>
                <td className="td">{fmt(d.expenses)}</td>
                <td className="td">{fmt(d.income - d.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
