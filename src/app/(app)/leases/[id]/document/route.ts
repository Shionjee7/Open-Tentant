import { getLease, getProperty, getUnit, leaseTenantIds, getPerson } from "@/lib/data";
import { getSetting } from "@/lib/data";
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
  const lease = await getLease(id);
  if (!lease) {
    return new Response("Lease not found", { status: 404 });
  }

  const property = await getProperty(lease.property);
  if (!property) {
    return new Response("Property not found", { status: 404 });
  }

  const unit = lease.unit ? await getUnit(lease.unit) : undefined;
  const tenants = (await Promise.all((await leaseTenantIds(lease.id)).map((personId) => getPerson(personId)))).filter((p): p is Person => Boolean(p));

  const html = buildLeaseDocument({
    lease,
    property,
    unit,
    tenants,
    landlordName: await getSetting("business_name", "Landlord"),
    paymentInstructions: await getSetting("payment_instructions"),
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
