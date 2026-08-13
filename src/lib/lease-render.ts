import {
  getLease,
  getPerson,
  getProperty,
  getSetting,
  getUnit,
  leaseTenantIds,
  listSignatures,
} from "./data";
import { buildLeaseDocument } from "./lease-document";
import { loadLeaseTerms } from "./lease-terms";
import { documentHash } from "./signing";
import type { Id, Lease, Person, Property, Signature, Unit } from "./types";

/**
 * One place that turns a lease record into its document.
 *
 * The printable view, the signing page, and the hash we ask signers to stand
 * behind all go through here, so there is no way for a signer to agree to one
 * rendering while the landlord files another.
 */
export type RenderedLease = {
  lease: Lease;
  property: Property;
  unit?: Unit;
  tenants: Person[];
  landlordName: string;
  signatures: Signature[];
  /** The document as it stands, signatures included. */
  html: string;
  /** SHA-256 of the terms alone — stable as signatures are added. */
  hash: string;
};

export async function renderLease(leaseId: Id): Promise<RenderedLease | undefined> {
  const lease = await getLease(leaseId);
  if (!lease) return undefined;

  const property = await getProperty(lease.property);
  if (!property) return undefined;

  const unit = lease.unit ? await getUnit(lease.unit) : undefined;
  const tenants = (
    await Promise.all((await leaseTenantIds(lease.id)).map((personId) => getPerson(personId)))
  ).filter((p): p is Person => Boolean(p));

  const signatures = await listSignatures(lease.id);
  const landlordName = (await getSetting("business_name")) || "Landlord";

  const input = {
    lease,
    property,
    unit,
    tenants,
    landlordName,
    landlordAddress: await getSetting("business_address"),
    paymentInstructions: await getSetting("payment_instructions"),
    contactEmail: (await getSetting("smtp_notify_email")) || (await getSetting("smtp_user")),
    terms: await loadLeaseTerms(),
  };

  const html = buildLeaseDocument({ ...input, signatures });

  return {
    lease,
    property,
    unit,
    tenants,
    landlordName,
    signatures,
    html,
    // Hash the unsigned rendering: the terms, and only the terms.
    hash: documentHash(buildLeaseDocument(input)),
  };
}

/** A human label for the premises — "12 Oak St — Room 2". */
export function premisesLabel(rendered: RenderedLease): string {
  const address = [
    rendered.property.address,
    [rendered.property.city, rendered.property.state].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ");
  const base = address || rendered.property.name;
  return rendered.unit ? `${base} — ${rendered.unit.name}` : base;
}
