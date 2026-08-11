import type { Lease, Person, Property, Unit } from "./types";
import { moneyExact, shortDate } from "./format";

/**
 * Builds a residential lease from the data already in the app.
 *
 * Modeled on a real room-rental lease: a summary table, a rent-and-deposits
 * table, a penalties-and-fees table, then the numbered clauses. Every name,
 * address, amount, and fee comes from app data or your settings — nothing
 * about any particular landlord or tenant is baked in.
 *
 * The output is self-contained HTML sized for US Letter, so it prints or
 * "Save as PDF"s straight from the browser, with signature blocks at the end
 * for an e-signature tool to drop fields onto.
 *
 * These are common terms, not legal advice. Landlord-tenant law is state and
 * city specific, so the document says to check it against local requirements.
 */

/** Money amounts and policies a landlord can tune without touching code. */
export type LeaseTerms = {
  lateFeeAmount: number;
  lateFeeAfterDays: number;
  evictionAfterDays: number;
  keyReplacementFee: number;
  cleaningFee: number;
  noticeDays: number;
  smokingInsideFee: number;
  detectorTamperFee: number;
  /** Extra charged per month in winter, e.g. toward heating. 0 hides the clause. */
  winterSurcharge: number;
  winterMonths: string;
  petsAllowed: boolean;
  /** Free-text house rules, one per line, appended to the rules clause. */
  houseRules: string;
  governingState: string;
};

export const DEFAULT_LEASE_TERMS: LeaseTerms = {
  lateFeeAmount: 50,
  lateFeeAfterDays: 3,
  evictionAfterDays: 7,
  keyReplacementFee: 30,
  cleaningFee: 55,
  noticeDays: 30,
  smokingInsideFee: 350,
  detectorTamperFee: 100,
  winterSurcharge: 0,
  winterMonths: "December through March",
  petsAllowed: false,
  houseRules: "",
  governingState: "",
};

export type LeaseDocumentInput = {
  lease: Lease;
  property: Property;
  unit?: Unit;
  tenants: Person[];
  landlordName: string;
  landlordAddress: string;
  paymentInstructions: string;
  contactEmail: string;
  terms: LeaseTerms;
};

function esc(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(amount: number): string {
  return moneyExact(amount);
}

/** "Eight Hundred Seventy-Five Dollars ($875.00)" — leases spell amounts out. */
function spellDollars(amount: number): string {
  const ones = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  const words = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? `-${ones[n % 10]}` : "");
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred` + (n % 100 ? ` ${words(n % 100)}` : "");
    if (n < 1_000_000)
      return `${words(Math.floor(n / 1000))} Thousand` + (n % 1000 ? ` ${words(n % 1000)}` : "");
    return String(n);
  };

  const whole = Math.floor(Math.abs(amount));
  return `${words(whole)} Dollars (${money(amount)})`;
}

function row(label: string, value: string): string {
  return `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
}

export function buildLeaseDocument(input: LeaseDocumentInput): string {
  const { lease, property, unit, tenants, landlordName, landlordAddress, paymentInstructions, contactEmail, terms } = input;

  const propertyAddress = [
    property.address,
    [property.city, property.state].filter(Boolean).join(", "),
    property.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const byRoom = Boolean(unit);
  const premises = byRoom ? `${propertyAddress} — ${unit!.name}` : propertyAddress;
  const tenantNames =
    tenants.map((t) => `${t.first_name} ${t.last_name}`.trim()).filter(Boolean).join(", ") ||
    "____________________";

  const rent = lease.rent;
  const deposit = lease.deposit;
  const winterTotal = rent + terms.winterSurcharge;
  const state = terms.governingState || property.state || "the state where the Premises is located";

  // ---------- Summary tables ----------

  const summary = [
    row("Property address", esc(premises) + (byRoom ? " (private bedroom with shared use of common areas)" : "")),
    row("Landlord", esc(landlordName)),
    row("Tenant", esc(tenantNames)),
    row("Lease term", `${shortDate(lease.start_date)} – ${shortDate(lease.end_date)}, then continues month to month`),
    paymentInstructions
      ? row("Payment method", esc(paymentInstructions).replace(/\n/g, "<br />"))
      : "",
  ].join("");

  const rentRows = [
    row("Monthly rent", `<strong>${money(rent)}</strong> — due on the 1st of each month`),
    deposit > 0 ? row("Security deposit", `${money(deposit)} — due at move-in`) : "",
    deposit > 0 ? row("Total due at move-in", money(deposit)) : "",
    terms.winterSurcharge > 0
      ? row(
          "Winter charge",
          `${money(terms.winterSurcharge)} extra per month, ${esc(terms.winterMonths)} (total ${money(winterTotal)} those months)`
        )
      : "",
    row(
      "Notice to move out",
      `${terms.noticeDays} days written notice required — leaving without it forfeits the deposit`
    ),
    terms.cleaningFee > 0
      ? row("Cleaning fee", `${money(terms.cleaningFee)} — added to the last month's rent`)
      : "",
  ].join("");

  const feeRows = [
    terms.lateFeeAmount > 0
      ? row("Late fee", `${money(terms.lateFeeAmount)} — if rent is not paid within ${terms.lateFeeAfterDays} days of the due date`)
      : "",
    row("Eviction trigger", `Rent unpaid for ${terms.evictionAfterDays} days from the due date`),
    terms.keyReplacementFee > 0 ? row("Unreturned key", `${money(terms.keyReplacementFee)} per key`) : "",
    terms.smokingInsideFee > 0
      ? row(
          "Smoking policy",
          `No smoking inside the Premises. Smoking inside: ${money(terms.smokingInsideFee)} plus damages and remediation, and immediate lease termination`
        )
      : "",
    terms.detectorTamperFee > 0
      ? row("Tampering with smoke / CO detector", `${money(terms.detectorTamperFee)} per occurrence`)
      : "",
    row("Pets", terms.petsAllowed ? "Permitted with written consent" : "No pets permitted on the Premises"),
    row("Theft or damage to landlord property", "Immediate lease termination and deposit deduction"),
    row("Drug activity or harassment", "Immediate lease termination"),
  ].join("");

  // ---------- Numbered clauses ----------

  const extraRules = terms.houseRules
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const clauses: [string, string][] = [
    [
      "Term",
      `Landlord leases to Tenant, and Tenant leases from Landlord, ${byRoom ? `${esc(unit!.name)} of the Property, together with shared, non-exclusive use of the common areas (kitchen, bathroom(s), hallways, and laundry, if provided)` : "the Premises"},
       beginning on ${shortDate(lease.start_date)} and ending on ${shortDate(lease.end_date)}. After the initial term, this Lease
       automatically continues as a month-to-month tenancy on the same terms and rent, unless either party gives written
       notice as described below.`,
    ],
    [
      "Rent",
      `${deposit > 0 ? `A security deposit of ${money(deposit)} is due at move-in. ` : ""}Monthly rent of <strong>${money(rent)}</strong> is due in full on the 1st of every month.
       ${terms.winterSurcharge > 0 ? `From ${esc(terms.winterMonths)}, Tenant shall pay an additional ${money(terms.winterSurcharge)} per month toward heating, making the total ${money(winterTotal)} for those months. ` : ""}
       ${paymentInstructions ? `All payments shall be made as follows: ${esc(paymentInstructions).replace(/\n/g, "<br />")}` : ""}`,
    ],
    [
      "Notice to move out; month-to-month tenancy",
      `Tenant must give Landlord at least ${terms.noticeDays} days written notice before moving out — whether at the end of the
       initial term or at any time during the month-to-month period that follows.
       ${contactEmail ? `Written notice by email to ${esc(contactEmail)} is acceptable. ` : ""}
       If Tenant moves out without giving full ${terms.noticeDays} days written notice, Tenant shall owe rent for the notice period, and the
       security deposit shall be applied toward that amount and shall not be returned. If the rent owed exceeds the deposit,
       Tenant remains liable for the difference. Landlord may likewise end the month-to-month tenancy with ${terms.noticeDays} days written notice.`,
    ],
    [
      "Damage deposit",
      `${deposit > 0 ? `Tenant shall deposit with Landlord the sum of ${spellDollars(deposit)} as security for any damage caused to the Premises during the term. ` : ""}
       The deposit shall be returned without interest, less any set-off for damages and any amounts owed for insufficient notice,
       upon termination. To receive a full return of the deposit: Tenant must have no outstanding rent; Tenant must have given the
       required written notice; no unreasonable damage or alteration shall have been made beyond normal wear and tear;
       ${terms.keyReplacementFee > 0 ? `all keys must be returned, or Tenant shall be charged ${money(terms.keyReplacementFee)} per key; ` : ""}
       and the property must be left clean and in proper condition.
       <br /><br />
       <strong>Liability beyond the deposit.</strong> If the cost of repairs, replacement, cleaning, or remediation exceeds the deposit,
       Tenant remains personally liable for the balance, including reasonable contractor, material, and labor costs, and, if collection
       becomes necessary, court costs and reasonable attorneys' fees.
       <br /><br />
       <strong>Itemized statement.</strong> Landlord shall provide Tenant with an itemized written statement of any deductions,
       together with any remaining balance, within the period required by the law of ${esc(state)} after termination and Tenant's vacating.`,
    ],
    [
      "Use of premises",
      `The Premises shall be used and occupied solely as a dwelling by the Tenant named above. Tenant shall not allow any other
       person, other than transient guests, to occupy the Premises without Landlord's written consent. Tenant shall comply with all
       laws, ordinances, and rules affecting the cleanliness, use, occupancy, and preservation of the Premises.`,
    ],
    [
      "Condition of premises",
      `Tenant has examined the Premises and warrants that at move-in they are in good order, repair, and in a safe, clean, and
       tenantable condition, except as documented in the move-in condition report. Tenant agrees to point out any prior damage at
       move-in and to leave the residence in the same clean and orderly condition at termination.
       ${terms.cleaningFee > 0 ? `Tenant shall include ${spellDollars(terms.cleaningFee)} in addition to the last month's rent, to be used for cleaning service.` : ""}`,
    ],
    [
      "Assignment and sub-letting",
      `Tenant shall not assign this Agreement, or sub-let or grant any license to use the Premises or any part thereof.`,
    ],
    [
      "Alterations and improvements",
      `Tenant shall make no alterations to the Premises without the prior written consent of Landlord. Any alterations or
       improvements placed on the Premises by Tenant shall become the property of Landlord and remain on the Premises at
       termination, unless otherwise agreed in writing.`,
    ],
    [
      "Property insurance",
      `Landlord shall maintain appropriate insurance for its interest in the Premises. Tenant has the option of maintaining
       renter's insurance at Tenant's own expense to cover Tenant's property located at the Premises.`,
    ],
    [
      "Maintenance and repairs; rules",
      `Landlord shall keep the Premises in good repair and perform repairs necessary to satisfy the implied warranty of
       habitability. Tenant shall promptly notify Landlord of any repairs needed, and shall keep the Premises in good and sanitary
       condition. Without limiting the foregoing, Tenant shall:
       <br />a. Not obstruct driveways, sidewalks, entryways, stairs, or halls;
       <br />b. Keep windows, doors, locks, and hardware in good, clean order and repair;
       <br />c. Not change or replace any lock without Landlord's prior written consent;
       <br />d. Keep all plumbing fixtures in good order and use them only for their intended purpose; any damage or cost of clearing
       stopped plumbing resulting from misuse shall be borne by Tenant;
       <br />e. Maintain order and not make or permit loud or improper noises that disturb other residents or neighbors;
       <br />f. Turn off lights and appliances when not in use or when exiting the Premises;
       ${terms.smokingInsideFee > 0 ? `<br />g. Not smoke inside the Premises. Smoking inside will result in a ${money(terms.smokingInsideFee)} charge plus damages and remediation, and immediate lease termination. Burning of candles is prohibited;` : ""}
       ${terms.detectorTamperFee > 0 ? `<br />h. Not tamper with or remove smoke or carbon monoxide detectors, which carries a ${money(terms.detectorTamperFee)} fee;` : ""}
       <br />i. Not engage in the unlawful manufacture, possession, distribution, or use of illegal substances on the Premises, which
       will result in immediate termination of this Lease;
       <br />j. Not harass or bully other tenants; intimidating, hostile, threatening, or abusive behavior will result in immediate
       termination of this Lease;
       <br />k. Not steal or damage property provided by Landlord or belonging to other tenants, which will result in immediate
       termination and deposit deduction to cover the loss${extraRules.length ? ";" : "."}
       ${extraRules.map((rule, i) => `<br />${String.fromCharCode(108 + i)}. ${esc(rule)}${i === extraRules.length - 1 ? "." : ";"}`).join("")}`,
    ],
    [
      "Inspection of premises",
      `Landlord and Landlord's agents may enter the Premises at reasonable times, after reasonable advance notice as required by
       applicable law, to inspect, make repairs or alterations, or show the Premises to prospective tenants or buyers. The right of
       entry exists without notice only in an emergency.`,
    ],
    [
      "Hazardous materials",
      `Tenant shall not keep on the Premises any item of a dangerous, flammable, or explosive character that might unreasonably
       increase the danger of fire or explosion, or that might be considered hazardous by a responsible insurance company.`,
    ],
    [
      "Utilities",
      `Responsibility for utility services is as agreed in writing between the parties.
       ${byRoom ? "Unless stated otherwise, utilities for the shared residence are included in the rent." : "Unless stated otherwise, Tenant is responsible for utilities serving the Premises."}`,
    ],
    [
      "Animals",
      terms.petsAllowed
        ? `Pets are permitted only with Landlord's prior written consent, which may be conditioned on a pet deposit or pet rent where allowed by law.`
        : `No animals or pets are permitted on the Premises.`,
    ],
    [
      "Termination upon sale of premises",
      `Notwithstanding any other provision of this Lease, Landlord may terminate this Lease upon ${terms.noticeDays} days written notice to
       Tenant when the Premises have been sold.`,
    ],
    [
      "Damage to premises",
      `If the Premises are destroyed or rendered wholly untenantable by fire, storm, or other casualty not caused by Tenant's
       negligence, this Agreement shall terminate as of that time, with rent accounted for up to the date of the casualty. If only a
       portion is rendered untenantable, Landlord may either repair it — with rent abating in proportion — or terminate this Lease.`,
    ],
    [
      "Quiet enjoyment",
      `Tenant, upon payment of all sums due and performance of all obligations under this Lease, shall peacefully and quietly have,
       hold, and enjoy the Premises for the term hereof.`,
    ],
    [
      "Indemnification",
      `Landlord shall not be liable for any damage or injury to Tenant, Tenant's family, guests, invitees, or employees, or to their
       goods or equipment, and Tenant agrees to indemnify, defend, and hold Landlord harmless from any and all claims arising from
       Tenant's use of the Premises, except to the extent caused by Landlord's negligence or as otherwise required by law.`,
    ],
    [
      "Default, late charge, and remedies",
      `Time is of the essence with respect to all payments due under this Lease. Failure to pay rent when due is a material breach.
       ${terms.lateFeeAmount > 0 ? `If payment is not received within ${terms.lateFeeAfterDays} days of the due date, Tenant shall owe a late fee of ${money(terms.lateFeeAmount)}. ` : ""}
       If payment is not received within ${terms.evictionAfterDays} days of the due date, Landlord may initiate eviction proceedings in accordance with the
       laws of ${esc(state)}, including the filing of an unlawful detainer action in the appropriate court.
       <br /><br />
       Tenant understands that only the appropriate court and the sheriff have authority to lawfully remove a tenant, change locks,
       or remove property from the Premises. Tenant shall remain liable for all unpaid rent, damages, legal fees, court costs, and
       enforcement expenses.
       <br /><br />
       If Tenant fails to comply with any other material provision and the noncompliance continues for ${terms.evictionAfterDays} days after written
       notice, Landlord may terminate this Lease and proceed through the court process.`,
    ],
    [
      "Abandonment",
      `If Tenant abandons the Premises, Landlord may take possession and re-let the Premises, using reasonable efforts to mitigate
       damages, and Tenant shall remain liable for rent and costs to the extent permitted by law. Property left behind shall be
       handled in accordance with the law of ${esc(state)}.`,
    ],
    [
      "Surrender of premises",
      `Upon expiration of the term, Tenant shall surrender the Premises in as good a state and condition as at commencement,
       reasonable use and wear and tear excepted.`,
    ],
    [
      "Entire agreement",
      `This Lease, together with any written addenda signed by both parties, is the entire agreement between them and replaces any
       prior understandings. Any change must be in writing and signed by both parties. If any provision is found unenforceable, the
       rest remains in effect. This Lease is governed by the laws of ${esc(state)}, and any term that conflicts with applicable law is
       superseded by that law.`,
    ],
  ];

  const clauseHtml = clauses
    .filter(([, body]) => body.trim())
    .map(
      ([title, body], i) => `
  <section class="clause">
    <h2>${i + 1}. ${esc(title).toUpperCase()}</h2>
    <p>${body.replace(/\s+/g, " ").trim()}</p>
  </section>`
    )
    .join("");

  const signatureBlocks = (tenants.length ? tenants : [null])
    .map((t, i) => {
      const name = t ? `${t.first_name} ${t.last_name}`.trim() : "";
      return `
      <div class="sig">
        <div class="sig-line" data-signer="tenant-${i + 1}"></div>
        <div class="sig-label">Tenant signature${name ? ` — ${esc(name)}` : ""}</div>
        <div class="sig-line small"></div>
        <div class="sig-label">Date</div>
      </div>`;
    })
    .join("");

  const title = `Residential Lease Agreement — ${premises}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: letter; margin: 0.85in; }
  * { box-sizing: border-box; }
  body {
    font: 11pt/1.5 Georgia, "Times New Roman", serif;
    color: #111; margin: 0; padding: 32px;
    max-width: 8.5in; margin-inline: auto; background: #fff;
  }
  h1 { font-size: 18pt; text-align: center; margin: 0 0 3px; letter-spacing: .01em; }
  .sub { text-align: center; color: #444; font-size: 10.5pt; margin-bottom: 6px; }
  .parties { margin: 14px 0 20px; }
  h3 { font-size: 11pt; margin: 20px 0 6px; letter-spacing: .06em; text-transform: uppercase; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th, td { border: 1px solid #bbb; padding: 6px 9px; text-align: left; font-size: 10pt; vertical-align: top; }
  th { background: #f2f2f2; width: 34%; font-weight: bold; }
  .clause { margin-bottom: 11px; page-break-inside: avoid; }
  .clause h2 { font-size: 10.5pt; margin: 0 0 3px; letter-spacing: .03em; }
  .clause p { margin: 0; text-align: justify; }
  .sigs { margin-top: 30px; page-break-inside: avoid; }
  .sig { margin-top: 24px; page-break-inside: avoid; }
  .sig-line { border-bottom: 1px solid #333; height: 28px; width: 68%; }
  .sig-line.small { width: 32%; margin-top: 16px; }
  .sig-label { font-size: 9pt; color: #555; margin-top: 3px; }
  .notice {
    margin-top: 28px; border-top: 1px solid #ccc; padding-top: 9px;
    font-size: 8.5pt; color: #666; font-family: system-ui, sans-serif;
  }
  @media print { body { padding: 0; } .noprint { display: none !important; } }
  .noprint {
    font-family: system-ui, sans-serif; background: #eef4ff; border: 1px solid #c7dbff;
    padding: 11px 14px; border-radius: 8px; margin-bottom: 22px; font-size: 10pt; color: #1b46a3;
  }
</style>
</head>
<body>
  <div class="noprint">
    <strong>Ready to sign.</strong> Print this page or choose “Save as PDF”, then send that file for signature.
  </div>

  <h1>Residential Lease Agreement</h1>
  <div class="sub">${esc(premises)}</div>

  <p class="parties">
    THIS LEASE AGREEMENT (the “Agreement”) is made and entered into by and between
    <strong>${esc(landlordName)}</strong> (“Landlord”)${landlordAddress ? `, of ${esc(landlordAddress)},` : ""}
    and <strong>${esc(tenantNames)}</strong> (“Tenant”).
  </p>

  <h3>Lease summary</h3>
  <table>${summary}</table>

  <h3>Rent &amp; deposits</h3>
  <table>${rentRows}</table>

  <h3>Penalties &amp; fees</h3>
  <table>${feeRows}</table>

  <h3>Terms and conditions</h3>
  ${clauseHtml}

  <div class="sigs">
    <h3>Signatures</h3>
    <p style="margin:0;font-size:10pt;">By signing below, the parties agree to the terms of this Lease.</p>

    <div class="sig">
      <div class="sig-line" data-signer="landlord"></div>
      <div class="sig-label">Landlord signature — ${esc(landlordName)}</div>
      <div class="sig-line small"></div>
      <div class="sig-label">Date</div>
    </div>

    ${signatureBlocks}
  </div>

  <p class="notice">
    Generated by OpenTenant. This is a general template, not legal advice. Landlord-tenant law varies by state and
    city — required disclosures, notice periods, deposit limits, and late-fee caps differ. Review this document
    against the law where the property is located, and have a local attorney check it before use.
  </p>
</body>
</html>`;
}
