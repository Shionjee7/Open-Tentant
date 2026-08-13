import Link from "next/link";
import { listMaintenance } from "@/lib/data";
import { setMaintenanceStatus } from "@/lib/actions";
import { shortDate } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Repairs" };

const NEXT: Record<string, { status: string; label: string }[]> = {
  new: [{ status: "in_progress", label: "Start" }, { status: "cancelled", label: "Cancel" }],
  in_progress: [{ status: "completed", label: "Complete" }],
  completed: [],
  cancelled: [{ status: "new", label: "Reopen" }],
};

export default async function MaintenancePage() {
  const requests = await listMaintenance();
  return (
    <>
      <PageHeader
        title="Repairs"
        subtitle="Track repair requests from new to done, with priorities."
        action={<Link href="/maintenance/new" className="btn">+ New request</Link>}
      />
      {requests.length === 0 ? (
        <EmptyState
          title="No maintenance requests"
          message="Log repair requests here — priority, status, and history per property."
          action={<Link href="/maintenance/new" className="btn">+ New request</Link>}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((m) => (
            <div key={m.id} className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{m.title}</span>
                  <Badge value={m.priority} />
                  <Badge value={m.status} />
                </div>
                <div className="mt-1 text-sm text-ink-500">
                  {m.property_name}
                  {m.tenant_name ? ` · reported by ${m.tenant_name}` : ""} · {shortDate(m.created)}
                  {m.completed_at ? ` · completed ${shortDate(m.completed_at)}` : ""}
                </div>
                {m.description && <p className="mt-1 max-w-2xl text-sm text-ink-700">{m.description}</p>}
              </div>
              <div className="flex gap-2">
                {(NEXT[m.status] ?? []).map((t) => (
                  <form key={t.status} action={setMaintenanceStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value={t.status} />
                    <button className={t.status === "cancelled" ? "btn-secondary btn-sm" : "btn btn-sm"}>
                      {t.label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
