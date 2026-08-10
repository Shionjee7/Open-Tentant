import { getLease, getProperty, getUnit, leaseTenantIds, getPerson } from "@/lib/data";
import { getSetting } from "@/lib/db";
import { buildLeaseDocument } from "@/lib/lease-document";
import type { Person } from "@/lib/types";

/**
 * Serves the lease as a printable document. Open it and use the browser's
 * "Save as PDF" to get a file you can upload to your e-signature tool.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lease = getLease(Number(id));
  if (!lease) {
    return new Response("Lease not found", { status: 404 });
  }

  const property = getProperty(lease.property_id);
  if (!property) {
    return new Response("Property not found", { status: 404 });
  }

  const unit = lease.unit_id ? getUnit(lease.unit_id) : undefined;
  const tenants = leaseTenantIds(lease.id)
    .map((personId) => getPerson(personId))
    .filter((p): p is Person => Boolean(p));

  const html = buildLeaseDocument({
    lease,
    property,
    unit,
    tenants,
    landlordName: getSetting("business_name", "Landlord"),
    paymentInstructions: getSetting("payment_instructions"),
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
