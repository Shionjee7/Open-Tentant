export function money(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function moneyExact(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function shortDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

/**
 * "Aug" inside one year, "Aug '25" when a list spans two — otherwise a run of
 * twelve months has two Augusts in it and no way to tell them apart.
 */
export function monthLabelIn(ym: string, allMonths: string[]): string {
  const years = new Set(allMonths.map((m) => m.slice(0, 4)));
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  if (years.size < 2) return date.toLocaleDateString("en-US", { month: "short" });
  return `${date.toLocaleDateString("en-US", { month: "short" })} '${String(y).slice(2)}`;
}

export function daysUntil(d: string): number {
  const target = new Date(d + "T00:00:00").getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
