import Link from "next/link";
import { titleCase } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueColor =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-ink-900";
  return (
    <div className="card px-4 py-3.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  // generic
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  signed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  occupied: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  tenant: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  income: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  // warning
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  sent: "bg-amber-50 text-amber-700 ring-amber-600/20",
  viewed: "bg-amber-50 text-amber-700 ring-amber-600/20",
  screening: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-600/20",
  applicant: "bg-amber-50 text-amber-700 ring-amber-600/20",
  requested: "bg-amber-50 text-amber-700 ring-amber-600/20",
  reported: "bg-violet-50 text-violet-700 ring-violet-600/20",
  upcoming: "bg-sky-50 text-sky-700 ring-sky-600/20",
  unpaid: "bg-sky-50 text-sky-700 ring-sky-600/20",
  lead: "bg-sky-50 text-sky-700 ring-sky-600/20",
  new: "bg-sky-50 text-sky-700 ring-sky-600/20",
  // bad
  past_due: "bg-rose-50 text-rose-700 ring-rose-600/20",
  denied: "bg-rose-50 text-rose-700 ring-rose-600/20",
  urgent: "bg-rose-50 text-rose-700 ring-rose-600/20",
  expense: "bg-rose-50 text-rose-700 ring-rose-600/20",
  ended: "bg-slate-100 text-slate-600 ring-slate-500/20",
  vacant: "bg-slate-100 text-slate-600 ring-slate-500/20",
  past: "bg-slate-100 text-slate-600 ring-slate-500/20",
  draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  const tone = BADGE_TONES[value] ?? "bg-slate-100 text-slate-600 ring-slate-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {label ?? titleCase(value)}
    </span>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-lg font-semibold text-ink-900">{title}</div>
      <p className="max-w-md text-sm text-ink-500">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * The "you haven't started yet" screen.
 *
 * A page with no data shouldn't render its whole skeleton full of zeros — six
 * $0 tiles, an empty chart, and three empty tables tell a first-time landlord
 * nothing except that the software is complicated. Until there is something to
 * show, show the two or three steps that produce it instead.
 */
export function StartHere({
  title,
  message,
  steps,
}: {
  title: string;
  message: string;
  steps: { href: string; label: string; detail: string; done?: boolean }[];
}) {
  return (
    <div className="card mx-auto max-w-2xl px-6 py-8">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-700">{message}</p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                step.done
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  step.done ? "bg-emerald-600 text-white" : "bg-slate-100 text-ink-700"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink-900">{step.label}</span>
                <span className="block text-sm text-ink-500">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The pages that belong to this one.
 *
 * The menu is seven entries and nothing hides behind a toggle, which only works
 * if every other page is one click from the entry that owns it. This is that
 * click — put it near the top of a hub page.
 */
export function HubLinks({
  links,
}: {
  links: { href: string; label: string; detail: string }[];
}) {
  return (
    <nav className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="card px-4 py-3 transition hover:border-brand-300 hover:shadow"
        >
          <div className="text-sm font-medium text-ink-900">{link.label}</div>
          <div className="mt-0.5 text-xs text-ink-500">{link.detail}</div>
        </Link>
      ))}
    </nav>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-brand-600 hover:underline">
      ← {label}
    </Link>
  );
}

export function ProBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-inset ring-violet-600/20">
      Pro · Free here
    </span>
  );
}
