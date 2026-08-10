import type { Lease, Person, Property, Unit } from "./types";
import { moneyExact, shortDate } from "./format";

/**
 * Builds a complete residential lease from the data already in the app.
 *
 * The output is self-contained HTML sized for US Letter, so the landlord can
 * print it or "Save as PDF" from the browser and then send that file for
 * signature. Signature blocks are laid out so an e-sign tool has somewhere
 * obvious to drop its fields.
 *
 * These are common, plainly-worded terms — not legal advice. Landlord-tenant
 * law is state and city specific, so the document tells the landlord to review
 * it against local requirements before using it.
 */

export type LeaseDocumentInput = {
  lease: Lease;
  property: Property;
  unit?: Unit;
  tenants: Person[];
  landlordName: string;
  paymentInstructions: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clause(n: number, title: string, body: string): string {
  return `
  <section class="clause">
    <h2>${n}. ${escapeHtml(title)}</h2>
    <p>${body}</p>
  </section>`;
}

export function buildLeaseDocument(input: LeaseDocumentInput): string {
  const { lease, property, unit, tenants, landlordName, paymentInstructions } = input;

  const premises = unit
    ? `${unit.name} at ${property.address}${property.city ? `, ${property.city}` : ""}${property.state ? `, ${property.state}` : ""} ${property.zip}`
    : `${property.address}${property.city ? `, ${property.city}` : ""}${property.state ? `, ${property.state}` : ""} ${property.zip}`;

  const tenantNames = tenants.length
    ? tenants.map((t) => `${t.first_name} ${t.last_name}`.trim()).join(", ")
    : "____________________";

  const rent = moneyExact(lease.rent);
  const deposit = moneyExact(lease.deposit);
  const sharedHome = Boolean(unit);

  const clauses = [
    [
      "Parties and premises",
      `This Residential Lease Agreement (the "Lease") is made between <strong>${escapeHtml(landlordName)}</strong>
       ("Landlord") and <strong>${escapeHtml(tenantNames)}</strong> ("Tenant"), for the premises located at
       <strong>${escapeHtml(premises)}</strong> (the "Premises").
       ${sharedHome ? "The Premises is a private room in a shared residence. Tenant has exclusive use of the room and shared use of common areas including the kitchen, living areas, and shared bathrooms." : ""}`,
    ],
    [
      "Term",
      `The Lease begins on <strong>${shortDate(lease.start_date)}</strong> and ends on
       <strong>${shortDate(lease.end_date)}</strong>. If Tenant remains in the Premises after the end date with
       Landlord's consent and no new agreement is signed, the tenancy continues month to month on these same terms
       until either party gives written notice as required by law.`,
    ],
    [
      "Rent",
      `Tenant agrees to pay rent of <strong>${rent} per month</strong>, due on the first day of each month.
       ${paymentInstructions ? `Rent is paid as follows: ${escapeHtml(paymentInstructions).replace(/\n/g, "<br />")}` : "Payment method to be provided by Landlord."}
       If rent is not received within the grace period allowed by applicable law, Landlord may charge a late fee
       to the extent permitted by law.`,
    ],
    [
      "Security deposit",
      `Tenant will pay a security deposit of <strong>${deposit}</strong> before taking possession. The deposit is
       held as security for unpaid rent and for damage beyond ordinary wear and tear. Landlord will return the
       deposit, less any lawful deductions with a written itemization, within the period required by applicable law
       after the tenancy ends and Tenant provides a forwarding address.`,
    ],
    [
      "Utilities",
      `Responsibility for utilities is as agreed in writing between the parties. ${sharedHome ? "Unless stated otherwise, utilities and internet for the shared residence are included in the rent." : "Unless stated otherwise, Tenant is responsible for utilities serving the Premises."}`,
    ],
    [
      "Use and occupancy",
      `The Premises is to be used as a private residence only, by the Tenant(s) named above and their minor children.
       Guests staying longer than fourteen (14) consecutive days require Landlord's written consent. Tenant will not
       use the Premises for any unlawful purpose or in a way that disturbs neighbors or ${sharedHome ? "other residents of the house" : "the neighborhood"}.`,
    ],
    [
      "Condition of the premises",
      `Tenant has examined the Premises and accepts it in its current condition, except as documented in the
       move-in condition report signed by both parties. Tenant will keep the Premises clean and sanitary and will
       promptly report any needed repairs to Landlord.`,
    ],
    [
      "Maintenance and repairs",
      `Landlord will maintain the Premises in a habitable condition and make repairs required by law. Tenant will
       pay for repairs of damage caused by Tenant, Tenant's household, or Tenant's guests. Tenant will not make
       alterations, paint, or install fixtures without Landlord's written consent.`,
    ],
    [
      "Entry by landlord",
      `Landlord may enter the Premises to inspect, make repairs, or show it to prospective tenants or buyers, after
       giving Tenant reasonable advance notice as required by applicable law, except in an emergency where immediate
       entry is necessary.`,
    ],
    [
      "Pets and smoking",
      `No pets are permitted without Landlord's written consent, which may be conditioned on a pet deposit or pet
       rent where allowed by law. Smoking is not permitted inside the Premises${sharedHome ? " or in shared areas of the residence" : ""}.`,
    ],
    [
      "Assignment and subletting",
      `Tenant may not assign this Lease or sublet the Premises, in whole or in part, without Landlord's prior
       written consent.`,
    ],
    [
      "Renters insurance",
      `Landlord's insurance does not cover Tenant's personal property. Tenant is encouraged to carry renters
       insurance covering personal belongings and personal liability.`,
    ],
    [
      "Default",
      `If Tenant fails to pay rent or breaches any other term of this Lease, Landlord may pursue the remedies
       available under applicable law, including termination of the tenancy after any notice and cure period
       required by law.`,
    ],
    [
      "Move-out",
      `At the end of the tenancy, Tenant will remove all personal property, return all keys, and leave the Premises
       clean and in the same condition as at move-in, ordinary wear and tear excepted. A move-out condition report
       will be completed and compared with the move-in report.`,
    ],
    [
      "Entire agreement",
      `This Lease, together with any written addenda signed by both parties, is the entire agreement between them
       and replaces any prior understandings. Any change must be in writing and signed by both parties. If any
       provision is found unenforceable, the rest of the Lease remains in effect. This Lease is governed by the laws
       of the state where the Premises is located, and any term that conflicts with applicable law is superseded by
       that law.`,
    ],
  ];

  const clauseHtml = clauses.map(([title, body], i) => clause(i + 1, title, body)).join("");

  const tenantSignatureBlocks = (tenants.length ? tenants : [null]).map((t, i) => {
    const name = t ? `${t.first_name} ${t.last_name}`.trim() : "";
    return `
      <div class="sig">
        <div class="sig-line" data-signer="tenant-${i + 1}"></div>
        <div class="sig-label">Tenant signature${name ? ` — ${escapeHtml(name)}` : ""}</div>
        <div class="sig-line small"></div>
        <div class="sig-label">Date</div>
      </div>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lease — ${escapeHtml(property.name)}${unit ? ` — ${escapeHtml(unit.name)}` : ""}</title>
<style>
  @page { size: letter; margin: 0.9in; }
  * { box-sizing: border-box; }
  body {
    font: 11.5pt/1.55 Georgia, "Times New Roman", serif;
    color: #111; margin: 0; padding: 32px;
    max-width: 8.5in; margin-inline: auto; background: #fff;
  }
  h1 { font-size: 19pt; text-align: center; margin: 0 0 4px; letter-spacing: .01em; }
  .sub { text-align: center; color: #555; font-size: 10pt; margin-bottom: 22px; }
  .facts { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  .facts th, .facts td { border: 1px solid #bbb; padding: 7px 10px; text-align: left; font-size: 10.5pt; }
  .facts th { background: #f2f2f2; width: 30%; font-weight: bold; }
  .clause { margin-bottom: 13px; }
  .clause h2 { font-size: 11.5pt; margin: 0 0 3px; }
  .clause p { margin: 0; text-align: justify; }
  .sigs { margin-top: 34px; page-break-inside: avoid; }
  .sigs h2 { font-size: 12pt; margin-bottom: 6px; }
  .sig { margin-top: 26px; page-break-inside: avoid; }
  .sig-line { border-bottom: 1px solid #333; height: 30px; width: 68%; }
  .sig-line.small { width: 32%; margin-top: 18px; }
  .sig-label { font-size: 9.5pt; color: #555; margin-top: 3px; }
  .notice {
    margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px;
    font-size: 9pt; color: #666; font-family: system-ui, sans-serif;
  }
  @media print { body { padding: 0; } .noprint { display: none !important; } }
  .noprint {
    font-family: system-ui, sans-serif; background: #eef4ff; border: 1px solid #c7dbff;
    padding: 12px 14px; border-radius: 8px; margin-bottom: 24px; font-size: 10pt; color: #1b46a3;
  }
</style>
</head>
<body>
  <div class="noprint">
    <strong>Ready to sign.</strong> Print this page or choose “Save as PDF”, then upload the PDF to your
    e-signature tool and place signature fields on the lines at the bottom.
  </div>

  <h1>Residential Lease Agreement</h1>
  <div class="sub">${escapeHtml(property.name)}${unit ? ` — ${escapeHtml(unit.name)}` : ""}</div>

  <table class="facts">
    <tr><th>Landlord</th><td>${escapeHtml(landlordName)}</td></tr>
    <tr><th>Tenant(s)</th><td>${escapeHtml(tenantNames)}</td></tr>
    <tr><th>Premises</th><td>${escapeHtml(premises)}</td></tr>
    <tr><th>Lease term</th><td>${shortDate(lease.start_date)} through ${shortDate(lease.end_date)}</td></tr>
    <tr><th>Monthly rent</th><td>${rent}, due on the 1st of each month</td></tr>
    <tr><th>Security deposit</th><td>${deposit}</td></tr>
  </table>

  ${clauseHtml}

  <div class="sigs">
    <h2>Signatures</h2>
    <p style="margin:0 0 4px;font-size:10.5pt;">
      By signing below, the parties agree to the terms of this Lease.
    </p>

    <div class="sig">
      <div class="sig-line" data-signer="landlord"></div>
      <div class="sig-label">Landlord signature — ${escapeHtml(landlordName)}</div>
      <div class="sig-line small"></div>
      <div class="sig-label">Date</div>
    </div>

    ${tenantSignatureBlocks}
  </div>

  <p class="notice">
    Generated by OpenTenant. This is a general template, not legal advice. Landlord-tenant law varies by state
    and city — required disclosures, notice periods, deposit limits, and late-fee caps differ. Review this
    document against the law where the property is located, and have a local attorney check it before use.
  </p>
</body>
</html>`;
}
