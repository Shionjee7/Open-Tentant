import { notFound } from "next/navigation";
import { getConditionReport } from "@/lib/data";
import { updateConditionReport } from "@/lib/actions";
import { shortDate, titleCase } from "@/lib/format";
import { Badge, BackLink, PageHeader } from "@/components/ui";
import type { ConditionItem } from "@/lib/types";

export const metadata = { title: "Condition report" };

const DEFAULT_AREAS = [
  "Entry / Hallway", "Living Room", "Kitchen", "Appliances", "Bedroom 1", "Bedroom 2",
  "Bathroom", "Walls & Ceilings", "Floors & Carpet", "Windows & Doors",
  "Smoke / CO Detectors", "Exterior / Yard",
];

export default async function ConditionReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = getConditionReport(Number(id));
  if (!report) notFound();

  let items: ConditionItem[] = JSON.parse(report.items || "[]");
  if (items.length === 0) {
    items = DEFAULT_AREAS.map((area) => ({ area, condition: "", notes: "" }));
  }

  return (
    <>
      <BackLink href="/condition-reports" label="Condition reports" />
      <PageHeader
        title={`${titleCase(report.type)} report — ${report.property_name}`}
        subtitle={`Created ${shortDate(report.created_at)}${report.completed_at ? ` · completed ${shortDate(report.completed_at)}` : ""}`}
        action={<Badge value={report.status} />}
      />

      <form action={updateConditionReport} className="card max-w-4xl p-6">
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="item_count" value={items.length} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="th w-1/4">Area</th>
                <th className="th w-40">Condition</th>
                <th className="th">Notes / damage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="td">
                    <input type="hidden" name={`area_${i}`} value={item.area} />
                    <span className="font-medium">{item.area}</span>
                  </td>
                  <td className="td">
                    <select
                      name={`condition_${i}`}
                      defaultValue={item.condition}
                      className="input"
                      disabled={report.status === "completed"}
                    >
                      <option value="">Not checked</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </td>
                  <td className="td">
                    <input
                      name={`notes_${i}`}
                      defaultValue={item.notes}
                      className="input"
                      placeholder="e.g. scratch on counter"
                      disabled={report.status === "completed"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <label className="label">General notes</label>
          <textarea
            name="report_notes"
            rows={2}
            defaultValue={report.notes}
            className="input"
            disabled={report.status === "completed"}
          />
        </div>

        {report.status !== "completed" && (
          <div className="mt-5 flex gap-3">
            <button name="action" value="save" className="btn-secondary">Save draft</button>
            <button name="action" value="complete" className="btn">Complete report</button>
          </div>
        )}
        {report.status === "completed" && (
          <p className="mt-4 text-sm text-ink-500">
            This report is completed and locked. Print this page (Ctrl/Cmd+P) for tenant signatures at walkthrough.
          </p>
        )}
      </form>
    </>
  );
}
