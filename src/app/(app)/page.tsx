import Link from "next/link";
import {
  dashboardStats,
  isDatabaseEmpty,
  leasesExpiringWithin,
  listMaintenance,
  pastDuePayments,
  upcomingPayments,
} from "@/lib/data";
import { loadDemoData } from "@/lib/actions";
import { money, shortDate, daysUntil } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default function DashboardPage() {
  if (isDatabaseEmpty()) {
    return (
      <>
        <PageHeader
          title="Welcome to OpenTenant"
          subtitle="Free, open-source property management. Every feature unlocked — no $200/year plan."
        />
        <EmptyState
          title="Let's get you set up"
          message="Add your first property to start tracking leases, payments, and maintenance — or load demo data to explore every module with realistic sample records."
          action={
            <div className="flex gap-3">
              <Link href="/properties/new" className="btn">
                + Add your first property
              </Link>
              <form action={loadDemoData}>
                <button className="btn-secondary">Load demo data</button>
              </form>
            </div>
          }
        />
      </>
    );
  }

  const stats = dashboardStats();
  const pastDue = pastDuePayments();
  const upcoming = upcomingPayments();
  const expiring = leasesExpiringWithin(90);
  const openMaint = listMaintenance().filter((m) => m.status === "new" || m.status === "in_progress");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your portfolio at a glance."
        action={
          <div className="flex gap-2">
            <Link href="/properties/new" className="btn-secondary">+ Property</Link>
            <Link href="/payments/new" className="btn">+ Payment</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Properties" value={stats.properties} hint={`${stats.occupied} occupied · ${stats.vacant} vacant`} />
        <StatCard label="Occupancy" value={`${stats.occupancyRate}%`} hint={`${stats.activeLeases} active leases`} />
        <StatCard label="Active tenants" value={stats.tenants} hint={`${stats.leads} leads · ${stats.applicants} applicants`} />
        <StatCard label="Open maintenance" value={stats.openMaintenance} hint="new + in progress" />
        <StatCard label="Collected this month" value={money(stats.collectedThisMonth)} tone="good" />
        <StatCard label="Collected this year" value={money(stats.collectedThisYear)} tone="good" />
        <StatCard label="Past due" value={money(stats.pastDue)} tone={stats.pastDue > 0 ? "bad" : "default"} hint={`${pastDue.length} payment${pastDue.length === 1 ? "" : "s"}`} />
        <StatCard label="Leases expiring soon" value={expiring.length} hint="next 90 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Past due</h2>
            <Link href="/payments" className="text-sm text-brand-600 hover:underline">All payments →</Link>
          </div>
          {pastDue.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-500">Nothing past due. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pastDue.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{p.tenant_name ?? "—"} · {money(p.amount)}</div>
                    <div className="text-xs text-ink-500">{p.property_name ?? "No property"} · due {shortDate(p.due_date)}</div>
                  </div>
                  <Badge value="past_due" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Upcoming payments</h2>
            <Link href="/payments/new" className="text-sm text-brand-600 hover:underline">Record / schedule →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-500">No upcoming payments scheduled.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{p.tenant_name ?? "—"} · {money(p.amount)}</div>
                    <div className="text-xs text-ink-500">{p.property_name ?? "No property"} · due {shortDate(p.due_date)}</div>
                  </div>
                  <Badge value="upcoming" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Open maintenance</h2>
            <Link href="/maintenance" className="text-sm text-brand-600 hover:underline">All requests →</Link>
          </div>
          {openMaint.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-500">No open requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openMaint.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-ink-500">{m.property_name} · {shortDate(m.created_at)}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge value={m.priority} />
                    <Badge value={m.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Leases expiring in 90 days</h2>
            <Link href="/leases" className="text-sm text-brand-600 hover:underline">All leases →</Link>
          </div>
          {expiring.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-500">No leases expiring soon.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expiring.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{l.property_name}</div>
                    <div className="text-xs text-ink-500">{l.tenant_names ?? "No tenants"} · ends {shortDate(l.end_date)}</div>
                  </div>
                  <span className="text-xs font-semibold text-amber-600">{daysUntil(l.end_date)} days</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
