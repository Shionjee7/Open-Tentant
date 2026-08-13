"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { pb } from "./pb";
import { MENU_COOKIE } from "./nav";
import { premisesLabel, renderLease } from "./lease-render";
import {
  CONSENT_TEXT,
  clientIp,
  signingProgress,
  signingToken,
  signingUrl,
} from "./signing";
import {
  getLease,
  getPerson,
  getSetting,
  getSignatureByToken,
  leaseTenantIds,
  listBankAccounts,
  listSignatures,
  listAllUnits,
  listPayments,
  listPeople,
  listProperties,
  listQuestions,
  setSetting,
} from "./data";
import { seedDemoData } from "./seed";
import { detectAccount, fingerprint, matchScore, parseStatement } from "./statements";
import { createSignatureRequest, fetchDocumentStatus, hasApiAccess } from "./opensign";
import { sendEmail, sendEmailQuietly, smtpConfig, templates } from "./email";
import type { Id } from "./types";

function s(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function n(form: FormData, key: string): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : 0;
}

function flag(form: FormData, key: string): boolean {
  return form.get(key) !== null;
}

/** PocketBase stores an empty relation as "", never null. */
function rel(form: FormData, key: string): string {
  return s(form, key);
}

function refresh() {
  revalidatePath("/", "layout");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Switch between the short menu and the full one. A cookie rather than a
 * setting, because it's a per-person preference on a shared account.
 */
export async function setMenuMode(form: FormData) {
  const mode = s(form, "mode") === "all" ? "all" : "simple";
  const store = await cookies();
  store.set(MENU_COOKIE, mode, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  refresh();
}

/** Public base URL, used to build links inside emails. */
async function appUrl(): Promise<string> {
  return (
    process.env.APP_URL?.trim() ||
    (await getSetting("app_url")) ||
    "http://localhost:3000"
  );
}

async function businessName(): Promise<string> {
  return (await getSetting("business_name")) || "OpenTenant";
}

async function portalUrlFor(token: string): Promise<string> {
  return `${await appUrl()}/portal/${token}`;
}

/**
 * Where landlord notifications go. Resolved through the SMTP config so an
 * environment variable works just as well as the saved setting, and so it
 * falls back to the sending account when no separate address is set.
 */
async function landlordInbox(): Promise<string> {
  return (await smtpConfig()).notifyEmail;
}

// ---------- Demo data ----------

export async function loadDemoData() {
  await seedDemoData();
  refresh();
}

// ---------- Properties ----------

export async function createProperty(form: FormData) {
  const client = await pb();
  const byRoom = s(form, "rental_type") === "by_room";

  const property = await client.collection("properties").create({
    name: s(form, "name"),
    address: s(form, "address"),
    city: s(form, "city"),
    state: s(form, "state"),
    zip: s(form, "zip"),
    type: s(form, "type"),
    beds: n(form, "beds"),
    baths: n(form, "baths"),
    sqft: n(form, "sqft"),
    rent: n(form, "rent"),
    deposit: n(form, "deposit"),
    status: "vacant",
    listed: flag(form, "listed"),
    priority_listing: flag(form, "priority_listing"),
    description: s(form, "description"),
    amenities: s(form, "amenities"),
    rental_type: byRoom ? "by_room" : "whole",
  });

  if (byRoom) {
    const rooms = Math.max(0, Math.min(20, n(form, "room_count")));
    const roomRent = n(form, "room_rent");
    for (let i = 0; i < rooms; i++) {
      await client.collection("units").create({
        property: property.id,
        name: `Room ${i + 1}`,
        rent: roomRent,
        deposit: roomRent,
        status: "vacant",
        listed: true,
      });
    }
  }

  refresh();
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  await client.collection("properties").update(id, {
    name: s(form, "name"),
    address: s(form, "address"),
    city: s(form, "city"),
    state: s(form, "state"),
    zip: s(form, "zip"),
    type: s(form, "type"),
    beds: n(form, "beds"),
    baths: n(form, "baths"),
    sqft: n(form, "sqft"),
    rent: n(form, "rent"),
    deposit: n(form, "deposit"),
    status: s(form, "status") || "vacant",
    listed: flag(form, "listed"),
    priority_listing: flag(form, "priority_listing"),
    description: s(form, "description"),
    amenities: s(form, "amenities"),
    rental_type: s(form, "rental_type") === "by_room" ? "by_room" : "whole",
  });
  refresh();
  redirect(`/properties/${id}`);
}

// ---------- Rooms (units) ----------

/**
 * A by-the-room property counts as occupied when any room is taken, and vacant
 * once every room is empty.
 */
async function syncPropertyOccupancy(propertyId: Id) {
  if (!propertyId) return;
  const client = await pb();
  const property = await client.collection("properties").getOne(propertyId).catch(() => null);
  if (!property || property.rental_type !== "by_room") return;

  const rooms = await client
    .collection("units")
    .getFullList({ perPage: 200, filter: `property="${propertyId}"` });
  const anyOccupied = rooms.some((room) => room.status === "occupied");
  await client
    .collection("properties")
    .update(propertyId, { status: anyOccupied ? "occupied" : "vacant" });
}

export async function createUnit(form: FormData) {
  const client = await pb();
  const propertyId = s(form, "property_id");
  await client.collection("units").create({
    property: propertyId,
    name: s(form, "name") || "Room",
    rent: n(form, "rent"),
    deposit: n(form, "deposit"),
    status: "vacant",
    size_sqft: n(form, "size_sqft"),
    private_bath: flag(form, "private_bath"),
    furnished: flag(form, "furnished"),
    listed: flag(form, "listed"),
    description: s(form, "description"),
  });
  await syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

/** Adds several rooms at once — "this house has 4 bedrooms" in one step. */
export async function addRooms(form: FormData) {
  const client = await pb();
  const propertyId = s(form, "property_id");
  const count = Math.max(1, Math.min(20, n(form, "count")));
  const existing = await client
    .collection("units")
    .getFullList({ perPage: 200, filter: `property="${propertyId}"` });

  for (let i = 0; i < count; i++) {
    await client.collection("units").create({
      property: propertyId,
      name: `Room ${existing.length + i + 1}`,
      rent: n(form, "rent"),
      deposit: n(form, "deposit"),
      status: "vacant",
      listed: true,
    });
  }
  await syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function updateUnit(form: FormData) {
  const client = await pb();
  const propertyId = s(form, "property_id");
  await client.collection("units").update(s(form, "id"), {
    name: s(form, "name"),
    rent: n(form, "rent"),
    deposit: n(form, "deposit"),
    size_sqft: n(form, "size_sqft"),
    private_bath: flag(form, "private_bath"),
    furnished: flag(form, "furnished"),
    listed: flag(form, "listed"),
    description: s(form, "description"),
    status: s(form, "status") || "vacant",
  });
  await syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function deleteUnit(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const propertyId = s(form, "property_id");

  // Don't leave people or leases pointing at a room that no longer exists.
  const residents = await client
    .collection("people")
    .getFullList({ perPage: 200, filter: `unit="${id}"` });
  for (const person of residents) {
    await client.collection("people").update(person.id, { unit: "" });
  }
  const leases = await client
    .collection("leases")
    .getFullList({ perPage: 200, filter: `unit="${id}"` });
  for (const lease of leases) {
    await client.collection("leases").update(lease.id, { unit: "" });
  }

  await client.collection("units").delete(id);
  await syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

/** Assigns (or clears) the tenant living in a room. */
export async function assignRoomTenant(form: FormData) {
  const client = await pb();
  const unitId = s(form, "unit_id");
  const propertyId = s(form, "property_id");
  const personId = s(form, "person_id");

  const current = await client
    .collection("people")
    .getFullList({ perPage: 200, filter: `unit="${unitId}"` });
  for (const person of current) {
    await client.collection("people").update(person.id, { unit: "" });
  }

  if (personId) {
    await client.collection("people").update(personId, {
      unit: unitId,
      property: propertyId,
      stage: "tenant",
    });
    await client.collection("units").update(unitId, { status: "occupied" });
  } else {
    await client.collection("units").update(unitId, { status: "vacant" });
  }

  await syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function toggleListing(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const field = s(form, "field") === "priority_listing" ? "priority_listing" : "listed";
  const property = await client.collection("properties").getOne(id);
  await client.collection("properties").update(id, { [field]: !property[field] });
  refresh();
}

// ---------- People ----------

export async function createPerson(form: FormData) {
  const client = await pb();
  const stage = s(form, "stage") || "lead";
  await client.collection("people").create({
    first_name: s(form, "first_name"),
    last_name: s(form, "last_name"),
    email: s(form, "email"),
    phone: s(form, "phone"),
    stage,
    property: rel(form, "property_id"),
    notes: s(form, "notes"),
    portal_token: crypto.randomUUID(),
  });
  refresh();
  redirect(`/contacts?stage=${stage}`);
}

export async function setPersonStage(form: FormData) {
  const client = await pb();
  await client.collection("people").update(s(form, "id"), { stage: s(form, "stage") });
  refresh();
}

// ---------- Custom questions ----------

export async function createQuestion(form: FormData) {
  const client = await pb();
  await client.collection("custom_questions").create({
    question: s(form, "question"),
    type: s(form, "type") || "text",
    required: flag(form, "required"),
    archived: false,
  });
  refresh();
}

export async function archiveQuestion(form: FormData) {
  const client = await pb();
  await client.collection("custom_questions").update(s(form, "id"), { archived: true });
  refresh();
}

// ---------- Applications ----------

export async function submitApplication(form: FormData) {
  const client = await pb();
  const unitId = rel(form, "unit_id");
  const propertyId = rel(form, "property_id");

  const person = await client.collection("people").create({
    first_name: s(form, "first_name"),
    last_name: s(form, "last_name"),
    email: s(form, "email"),
    phone: s(form, "phone"),
    stage: "applicant",
    property: propertyId,
    unit: unitId,
    portal_token: crypto.randomUUID(),
  });

  const questions = await listQuestions();
  const answers = questions.map((question) => ({
    question: question.question,
    answer: s(form, `q_${question.id}`),
  }));

  await client.collection("applications").create({
    person: person.id,
    property: propertyId,
    unit: unitId,
    status: "pending",
    monthly_income: n(form, "monthly_income"),
    employer: s(form, "employer"),
    income_verified: false,
    screening_status: "not_requested",
    answers,
    move_in_date: s(form, "move_in_date"),
  });

  // Confirm to the applicant, and tell the landlord something came in.
  const propertyRecord = propertyId
    ? await client.collection("properties").getOne(propertyId).catch(() => null)
    : null;
  const unitRecord = unitId
    ? await client.collection("units").getOne(unitId).catch(() => null)
    : null;
  const label = [propertyRecord?.name, unitRecord?.name].filter(Boolean).join(" — ") || "the property";
  const applicantName = `${s(form, "first_name")} ${s(form, "last_name")}`.trim();
  const business = await businessName();

  if (person.email) {
    const mail = templates.applicationReceived(business, applicantName, label);
    await sendEmailQuietly({ to: person.email, ...mail });
  }
  const landlordTo = await landlordInbox();
  const alert = templates.newApplicationAlert(
    business, applicantName, label, n(form, "monthly_income"), await appUrl()
  );
  await sendEmailQuietly({ to: landlordTo, replyTo: person.email, ...alert });

  refresh();
  redirect("/apply/thanks");
}

export async function setApplicationStatus(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const status = s(form, "status");
  await client.collection("applications").update(id, { status });

  const application = await client.collection("applications").getOne(id);

  if (status === "approved") {
    await client.collection("people").update(application.person, {
      stage: "tenant",
      property: application.property || "",
      unit: application.unit || "",
    });
    if (application.unit) {
      await client.collection("units").update(application.unit, { status: "occupied" });
      await syncPropertyOccupancy(application.property);
    }
  }

  if (status === "approved" || status === "denied") {
    const person = await client.collection("people").getOne(application.person).catch(() => null);
    if (person?.email) {
      const property = application.property
        ? await client.collection("properties").getOne(application.property).catch(() => null)
        : null;
      const unit = application.unit
        ? await client.collection("units").getOne(application.unit).catch(() => null)
        : null;
      const label = [property?.name, unit?.name].filter(Boolean).join(" — ") || "the property";
      const name = `${person.first_name} ${person.last_name}`.trim();
      const business = await businessName();
      const mail =
        status === "approved"
          ? templates.applicationApproved(business, name, label)
          : templates.applicationDenied(business, name, label);
      await sendEmailQuietly({ to: person.email, ...mail });
    }
  }
  refresh();
}

export async function setScreening(form: FormData) {
  const client = await pb();
  await client.collection("applications").update(s(form, "id"), {
    screening_status: s(form, "screening_status"),
    screening_notes: s(form, "screening_notes"),
    screening_link: s(form, "screening_link"),
  });
  refresh();
}

export async function toggleIncomeVerified(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const application = await client.collection("applications").getOne(id);
  await client
    .collection("applications")
    .update(id, { income_verified: !application.income_verified });
  refresh();
}

// ---------- Leases ----------

export async function createLease(form: FormData) {
  const client = await pb();
  const lease = await client.collection("leases").create({
    property: rel(form, "property_id"),
    unit: rel(form, "unit_id"),
    tenants: form.getAll("tenant_ids").map(String).filter(Boolean),
    start_date: s(form, "start_date"),
    end_date: s(form, "end_date"),
    rent: n(form, "rent"),
    deposit: n(form, "deposit"),
    status: s(form, "status") || "draft",
    esign_provider: s(form, "esign_provider"),
    esign_url: s(form, "esign_url"),
    notes: s(form, "notes"),
  });
  refresh();
  redirect(`/leases/${lease.id}`);
}

export async function setLeaseStatus(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const status = s(form, "status");
  await client.collection("leases").update(id, { status });

  const lease = await client.collection("leases").getOne(id);
  const tenantIds: string[] = Array.isArray(lease.tenants) ? lease.tenants : [];

  if (status === "active") {
    for (const tenantId of tenantIds) {
      await client.collection("people").update(tenantId, {
        stage: "tenant",
        property: lease.property,
        unit: lease.unit || "",
      });
    }
    if (lease.unit) {
      await client.collection("units").update(lease.unit, { status: "occupied" });
      await syncPropertyOccupancy(lease.property);
    } else {
      await client.collection("properties").update(lease.property, { status: "occupied" });
    }
  }

  if (status === "ended") {
    for (const tenantId of tenantIds) {
      await client.collection("people").update(tenantId, { stage: "past", unit: "" });
    }
    if (lease.unit) {
      await client.collection("units").update(lease.unit, { status: "vacant" });
      await syncPropertyOccupancy(lease.property);
    } else {
      await client.collection("properties").update(lease.property, { status: "vacant" });
    }
  }
  refresh();
}

// ---------- E-signature (OpenSign) ----------

export async function sendLeaseForSignature(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  const lease = await getLease(leaseId);
  if (!lease) return;

  const tenantIds = await leaseTenantIds(leaseId);
  const tenants = (await Promise.all(tenantIds.map((id) => getPerson(id)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  );
  const signers = tenants
    .filter((t) => t.email)
    .map((t) => ({ name: `${t.first_name} ${t.last_name}`.trim(), email: t.email }));

  const title = `Lease — ${lease.property_name}${lease.unit_name ? ` — ${lease.unit_name}` : ""}`;

  if (await hasApiAccess()) {
    if (signers.length === 0) redirect(`/leases/${leaseId}?esign=nosigners`);

    const origin = s(form, "origin") || "http://localhost:3000";
    const documentHtml = await fetch(`${origin}/leases/${leaseId}/document`)
      .then((response) => (response.ok ? response.text() : ""))
      .catch(() => "");
    if (!documentHtml) redirect(`/leases/${leaseId}?esign=nodoc`);

    const result = await createSignatureRequest({
      title,
      base64File: Buffer.from(documentHtml).toString("base64"),
      fileName: `lease-${leaseId}.html`,
      signers,
    });

    if (!result.ok) {
      await client.collection("leases").update(leaseId, {
        notes: `${lease.notes}\n[e-sign] ${result.error}`.trim().slice(0, 1000),
      });
      redirect(`/leases/${leaseId}?esign=failed`);
    }

    await client.collection("leases").update(leaseId, {
      status: "sent",
      esign_provider: "opensign",
      esign_url: result.signingUrl,
      esign_document_id: result.documentId,
    });
    await client.collection("documents").create({
      name: title,
      type: "lease",
      lease: leaseId,
      property: lease.property,
      status: "sent",
      provider: "opensign",
      external_url: result.signingUrl,
    });
    refresh();
    redirect(`/leases/${leaseId}?esign=sent`);
  }

  // Guided (free) mode.
  await client
    .collection("leases")
    .update(leaseId, { status: "sent", esign_provider: "opensign" });
  await client.collection("documents").create({
    name: title,
    type: "lease",
    lease: leaseId,
    property: lease.property,
    status: "sent",
    provider: "opensign",
  });
  refresh();
  redirect(`/leases/${leaseId}?esign=guided`);
}

// ---------- Built-in signing ----------

/**
 * Sends the lease for signature without leaving OpenTenant.
 *
 * One row per signer — every tenant with an email address, plus the landlord —
 * each with its own private link. Nothing is shared between them, so a tenant
 * can never sign on the landlord's behalf.
 */
export async function sendForSigning(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  const rendered = await renderLease(leaseId);
  if (!rendered) redirect("/leases");

  const tenantSigners = rendered.tenants.filter((t) => t.email);
  if (tenantSigners.length === 0) redirect(`/leases/${leaseId}?esign=nosigners`);

  const business = await businessName();
  const landlordEmail = await landlordInbox();
  const base = await appUrl();
  const now = new Date().toISOString();

  // Replacing an earlier round: cancel what's outstanding, keep what's signed.
  const existing = await listSignatures(leaseId);
  for (const old of existing.filter((x) => x.status === "pending")) {
    await client.collection("signatures").update(old.id, { status: "cancelled" });
  }

  const created: { name: string; email: string; token: string }[] = [];

  for (const tenant of tenantSigners) {
    const already = existing.find(
      (x) => x.status === "signed" && x.role === "tenant" && x.person === tenant.id
    );
    if (already) continue;
    const token = signingToken();
    await client.collection("signatures").create({
      lease: leaseId,
      person: tenant.id,
      role: "tenant",
      signer_name: `${tenant.first_name} ${tenant.last_name}`.trim(),
      signer_email: tenant.email,
      token,
      status: "pending",
      sent_at: now,
    });
    created.push({ name: tenant.first_name, email: tenant.email, token });
  }

  // The landlord signs from the lease page, so their row needs no email.
  const landlordSigned = existing.find((x) => x.status === "signed" && x.role === "landlord");
  if (!landlordSigned) {
    await client.collection("signatures").create({
      lease: leaseId,
      role: "landlord",
      signer_name: rendered.landlordName,
      signer_email: landlordEmail,
      token: signingToken(),
      status: "pending",
      sent_at: now,
    });
  }

  await client.collection("leases").update(leaseId, {
    status: rendered.lease.status === "draft" ? "sent" : rendered.lease.status,
    esign_provider: "opentenant",
  });

  const title = `Lease — ${rendered.lease.property_name}${
    rendered.lease.unit_name ? ` — ${rendered.lease.unit_name}` : ""
  }`;
  const documents = await client
    .collection("documents")
    .getFullList({ perPage: 50, filter: `lease="${leaseId}" && provider="opentenant"` });
  if (documents.length === 0) {
    await client.collection("documents").create({
      name: title,
      type: "lease",
      lease: leaseId,
      property: rendered.lease.property,
      status: "sent",
      provider: "opentenant",
    });
  }

  const premises = premisesLabel(rendered);
  for (const signer of created) {
    await sendEmailQuietly({
      to: signer.email,
      ...templates.signatureRequest(business, signer.name, premises, signingUrl(base, signer.token)),
    });
  }

  refresh();
  redirect(`/leases/${leaseId}?esign=requested`);
}

/**
 * Records a signature.
 *
 * Everything the audit trail needs is captured here, in one write, at the
 * moment the signer commits: their typed name, the consent they agreed to,
 * when, from where, and the hash of the terms they were shown.
 */
export async function signDocument(form: FormData) {
  const client = await pb();
  const token = s(form, "token");
  const signature = await getSignatureByToken(token);
  if (!signature || signature.status !== "pending") redirect(`/sign/${token}`);

  const typedName = s(form, "typed_name");
  if (!typedName || s(form, "consent") !== "yes" || s(form, "agree") !== "yes") {
    redirect(`/sign/${token}?notice=incomplete`);
  }

  const rendered = await renderLease(signature.lease);
  if (!rendered) redirect(`/sign/${token}`);

  const requestHeaders = await headers();
  // A drawn signature is optional; anything that isn't a PNG data URL is dropped.
  const drawn = s(form, "drawn_signature");
  const drawnSignature = drawn.startsWith("data:image/png;base64,") ? drawn.slice(0, 400000) : "";

  await client.collection("signatures").update(signature.id, {
    status: "signed",
    typed_name: typedName,
    drawn_signature: drawnSignature,
    consent_text: CONSENT_TEXT,
    document_hash: rendered.hash,
    ip: clientIp(requestHeaders),
    user_agent: (requestHeaders.get("user-agent") ?? "").slice(0, 300),
    signed_at: new Date().toISOString(),
  });

  await settleLease(signature.lease);
  refresh();
  redirect(`/sign/${token}`);
}

export async function declineDocument(form: FormData) {
  const client = await pb();
  const token = s(form, "token");
  const signature = await getSignatureByToken(token);
  if (!signature || signature.status !== "pending") redirect(`/sign/${token}`);

  await client.collection("signatures").update(signature.id, {
    status: "declined",
    decline_reason: s(form, "reason").slice(0, 300),
    signed_at: new Date().toISOString(),
  });

  const rendered = await renderLease(signature.lease);
  const inbox = await landlordInbox();
  if (inbox && rendered) {
    await sendEmailQuietly({
      to: inbox,
      ...templates.signatureDeclined(
        await businessName(),
        signature.signer_name,
        premisesLabel(rendered),
        s(form, "reason"),
        `${await appUrl()}/leases/${signature.lease}`
      ),
    });
  }

  refresh();
  redirect(`/sign/${token}?notice=declined`);
}

/**
 * Once everyone has signed, marks the lease signed and mails each party their
 * completed copy. Idempotent — running it again after the fact changes nothing.
 */
async function settleLease(leaseId: Id): Promise<void> {
  const client = await pb();
  const signatures = await listSignatures(leaseId);
  const progress = signingProgress(signatures);
  if (!progress.complete) return;

  const lease = await getLease(leaseId);
  if (!lease) return;
  if (lease.status !== "signed" && lease.status !== "active") {
    await client.collection("leases").update(leaseId, { status: "signed" });
  }

  const documents = await client
    .collection("documents")
    .getFullList({ perPage: 50, filter: `lease="${leaseId}"` });
  for (const document of documents.filter((d) => d.status !== "signed")) {
    await client
      .collection("documents")
      .update(document.id, { status: "signed", signed_at: todayIso() });
  }

  const rendered = await renderLease(leaseId);
  if (!rendered) return;
  const business = await businessName();
  const premises = premisesLabel(rendered);
  const base = await appUrl();

  for (const signer of signatures.filter((x) => x.status === "signed" && x.signer_email)) {
    await sendEmailQuietly({
      to: signer.signer_email,
      ...templates.signatureComplete(
        business,
        signer.typed_name || signer.signer_name,
        premises,
        signingUrl(base, signer.token)
      ),
    });
  }
}

/** Re-sends a signing link to someone who hasn't got to it yet. */
export async function remindSigner(form: FormData) {
  const signatureId = s(form, "signature_id");
  const leaseId = s(form, "lease_id");
  const signatures = await listSignatures(leaseId);
  const signature = signatures.find((x) => x.id === signatureId);
  if (!signature || signature.status !== "pending" || !signature.signer_email) {
    redirect(`/leases/${leaseId}`);
  }

  const rendered = await renderLease(leaseId);
  if (rendered) {
    await sendEmailQuietly({
      to: signature.signer_email,
      ...templates.signatureRequest(
        await businessName(),
        signature.signer_name.split(" ")[0] || signature.signer_name,
        premisesLabel(rendered),
        signingUrl(await appUrl(), signature.token)
      ),
    });
  }
  refresh();
  redirect(`/leases/${leaseId}?esign=reminded`);
}

/** Withdraws every outstanding request — the links stop working immediately. */
export async function cancelSigning(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  for (const signature of await listSignatures(leaseId)) {
    if (signature.status === "pending") {
      await client.collection("signatures").update(signature.id, { status: "cancelled" });
    }
  }
  refresh();
  redirect(`/leases/${leaseId}?esign=cancelled`);
}

export async function saveSigningLink(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  const url = s(form, "esign_url");
  await client
    .collection("leases")
    .update(leaseId, { esign_url: url, esign_provider: "opensign" });

  const documents = await client
    .collection("documents")
    .getFullList({ perPage: 50, filter: `lease="${leaseId}" && provider="opensign"` });
  for (const document of documents.filter((d) => !d.external_url)) {
    await client.collection("documents").update(document.id, { external_url: url });
  }
  refresh();
  redirect(`/leases/${leaseId}`);
}

export async function refreshSigningStatus(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  const lease = await client.collection("leases").getOne(leaseId);
  if (!lease.esign_document_id) redirect(`/leases/${leaseId}?esign=nostatus`);

  const status = await fetchDocumentStatus(lease.esign_document_id);
  if (!status) redirect(`/leases/${leaseId}?esign=nostatus`);

  if (status.status === "signed") {
    await client.collection("leases").update(leaseId, { status: "signed" });
    const documents = await client
      .collection("documents")
      .getFullList({ perPage: 50, filter: `lease="${leaseId}" && provider="opensign"` });
    for (const document of documents) {
      await client
        .collection("documents")
        .update(document.id, { status: "signed", signed_at: status.signedAt ?? todayIso() });
    }
  }
  refresh();
  redirect(`/leases/${leaseId}?esign=${status.status}`);
}

export async function markLeaseSigned(form: FormData) {
  const client = await pb();
  const leaseId = s(form, "lease_id");
  await client.collection("leases").update(leaseId, { status: "signed" });
  const documents = await client
    .collection("documents")
    .getFullList({ perPage: 50, filter: `lease="${leaseId}"` });
  for (const document of documents.filter((d) => d.status !== "signed")) {
    await client
      .collection("documents")
      .update(document.id, { status: "signed", signed_at: todayIso() });
  }
  refresh();
  redirect(`/leases/${leaseId}`);
}

// ---------- Payments ----------

export async function createPayment(form: FormData) {
  const client = await pb();
  const months = Math.max(1, Math.min(24, n(form, "repeat_months") || 1));
  const firstDue = s(form, "due_date");

  for (let i = 0; i < months; i++) {
    const due = new Date(`${firstDue}T00:00:00`);
    due.setMonth(due.getMonth() + i);
    await client.collection("payments").create({
      lease: rel(form, "lease_id"),
      person: rel(form, "person_id"),
      amount: n(form, "amount"),
      type: s(form, "type") || "rent",
      due_date: due.toISOString().slice(0, 10),
      status: "unpaid",
      notes: s(form, "notes"),
    });
  }
  refresh();
  redirect("/payments");
}

/** Books an income transaction for a payment that has been received. */
async function bookPaymentIncome(paymentId: Id, paidDate: string, method: string, note: string) {
  const client = await pb();
  const payment = await client.collection("payments").getOne(paymentId);
  let propertyId = "";
  if (payment.lease) {
    const lease = await client.collection("leases").getOne(payment.lease).catch(() => null);
    propertyId = lease?.property ?? "";
  }
  await client.collection("transactions").create({
    property: propertyId,
    date: paidDate,
    type: "income",
    category: payment.type === "rent" ? "rent" : payment.type,
    amount: payment.amount,
    description: note,
    payment: paymentId,
  });
}

export async function markPaymentPaid(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const method = s(form, "method") || "other";
  const paidDate = todayIso();
  await client
    .collection("payments")
    .update(id, { status: "paid", paid_date: paidDate, method });
  await bookPaymentIncome(id, paidDate, method, `Payment received (${method})`);
  await emailReceipt(id, paidDate, method);
  refresh();
}

/** Emails the tenant a receipt once a payment is recorded as paid. */
async function emailReceipt(paymentId: Id, paidDate: string, method: string) {
  const client = await pb();
  const payment = await client.collection("payments").getOne(paymentId).catch(() => null);
  if (!payment?.person) return;
  const person = await client.collection("people").getOne(payment.person).catch(() => null);
  if (!person?.email) return;

  const amount = payment.amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const mail = templates.paymentReceipt(
    await businessName(),
    `${person.first_name} ${person.last_name}`.trim(),
    amount,
    paidDate,
    method,
    await portalUrlFor(person.portal_token)
  );
  await sendEmailQuietly({ to: person.email, ...mail });
}

export async function deletePayment(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const payment = await client.collection("payments").getOne(id).catch(() => null);
  if (payment?.status === "unpaid") {
    await client.collection("payments").delete(id);
  }
  refresh();
}

// ---------- Tenant portal (token-authenticated) ----------

async function personForToken(token: string) {
  if (!token) return null;
  const client = await pb();
  return client
    .collection("people")
    .getFirstListItem(`portal_token="${token.replace(/"/g, "")}"`)
    .catch(() => null);
}

export async function portalReportPayment(form: FormData) {
  const token = s(form, "token");
  const person = await personForToken(token);
  if (!person) return;

  const client = await pb();
  const paymentId = s(form, "payment_id");
  const payment = await client.collection("payments").getOne(paymentId).catch(() => null);
  if (!payment || payment.status !== "unpaid") return;

  // The payment must belong to this tenant directly or through one of their leases.
  let allowed = payment.person === person.id;
  if (!allowed && payment.lease) {
    const lease = await client.collection("leases").getOne(payment.lease).catch(() => null);
    allowed = Array.isArray(lease?.tenants) && lease.tenants.includes(person.id);
  }
  if (!allowed) return;

  await client.collection("payments").update(paymentId, {
    status: "reported",
    reported_method: s(form, "reported_method") || "other",
    reported_date: s(form, "reported_date") || todayIso(),
    reported_note: s(form, "reported_note"),
  });
  refresh();
  redirect(`/portal/${token}`);
}

export async function portalCreateMaintenance(form: FormData) {
  const token = s(form, "token");
  const person = await personForToken(token);
  if (!person) return;

  const propertyId = person.property || s(form, "property_id");
  if (!propertyId) return;

  const client = await pb();
  const title = s(form, "title");
  const priority = s(form, "priority") || "medium";
  await client.collection("maintenance_requests").create({
    property: propertyId,
    unit: person.unit || "",
    person: person.id,
    title,
    description: s(form, "description"),
    priority,
    status: "new",
  });

  const business = await businessName();
  const tenantName = `${person.first_name} ${person.last_name}`.trim();
  if (person.email) {
    const mail = templates.maintenanceReceived(business, tenantName, title, await portalUrlFor(token));
    await sendEmailQuietly({ to: person.email, ...mail });
  }
  const property = await client.collection("properties").getOne(propertyId).catch(() => null);
  const alert = templates.maintenanceAlert(
    business, tenantName, property?.name ?? "a property", title, priority, await appUrl()
  );
  await sendEmailQuietly({ to: await landlordInbox(), ...alert });

  refresh();
  redirect(`/portal/${token}`);
}

export async function approveReportedPayment(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const payment = await client.collection("payments").getOne(id).catch(() => null);
  if (!payment || payment.status !== "reported") return;

  const paidDate = payment.reported_date || todayIso();
  const method = payment.reported_method || "other";
  await client.collection("payments").update(id, { status: "paid", paid_date: paidDate, method });
  await bookPaymentIncome(id, paidDate, method, `Tenant-reported payment approved (${method})`);
  await emailReceipt(id, paidDate, method);
  refresh();
}

export async function rejectReportedPayment(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const payment = await client.collection("payments").getOne(id).catch(() => null);
  if (!payment || payment.status !== "reported") return;
  await client.collection("payments").update(id, {
    status: "unpaid",
    reported_method: "",
    reported_date: "",
    reported_note: "",
  });
  refresh();
}

// ---------- Bank accounts & statement import ----------

export async function createBankAccount(form: FormData) {
  const client = await pb();
  await client.collection("bank_accounts").create({
    name: s(form, "name"),
    institution: s(form, "institution"),
    last4: s(form, "last4").replace(/\D/g, "").slice(-4),
    kind: s(form, "kind") || "bank",
    property: rel(form, "property_id"),
    notes: s(form, "notes"),
    opening_balance: n(form, "opening_balance"),
    balance_date: s(form, "balance_date"),
  });
  refresh();
  redirect("/banking");
}

/**
 * The balance a statement can't tell us.
 *
 * Imports only cover what was uploaded, so the running total needs a starting
 * point. Set it from a real statement and everything since is carried forward.
 */
export async function setAccountBalance(form: FormData) {
  const client = await pb();
  await client.collection("bank_accounts").update(s(form, "id"), {
    opening_balance: n(form, "opening_balance"),
    balance_date: s(form, "balance_date") || todayIso(),
  });
  refresh();
  redirect("/banking");
}

export async function deleteBankAccount(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const imports = await client
    .collection("bank_imports")
    .getFullList({ perPage: 500, filter: `account="${id}"` });
  for (const deposit of imports) {
    await client.collection("bank_imports").update(deposit.id, { account: "" });
  }
  await client.collection("bank_accounts").delete(id);
  refresh();
}

export async function importStatement(form: FormData) {
  const source = s(form, "source") || "bank";
  const depositsOnly = flag(form, "deposits_only");

  let text = s(form, "statement_text");
  const file = form.get("statement_file");
  if (file instanceof File && file.size > 0) {
    text = `${await file.text()}\n${text}`;
  }
  if (!text.trim()) redirect("/banking?error=empty");

  const rows = parseStatement(text);
  if (rows.length === 0) redirect("/banking?error=unparsed");

  const client = await pb();

  // Which account is this? Told, or worked out from the statement itself.
  let accountId = rel(form, "account_id");
  let detected = "";
  if (!accountId) {
    const accounts = await listBankAccounts();
    const guess = detectAccount(
      text,
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        last4: a.last4,
      }))
    );
    if (guess) {
      accountId = guess.id;
      const account = accounts.find((a) => a.id === guess.id);
      detected = `${account?.name ?? "an account"} — ${guess.reason}`;
    }
  }
  const existing = await client.collection("bank_imports").getFullList({ perPage: 1000 });
  const seen = new Set(existing.map((deposit) => deposit.fingerprint).filter(Boolean));

  /**
   * Payments already settled — usually because the tenant reported paying and
   * you approved it. When the same money then shows up in a bank statement, it
   * must not be bookable a second time, so those deposits are parked as
   * "already recorded" instead of landing in the review queue.
   */
  const paidPayments = (await listPayments()).filter((p) => p.status === "paid");

  let imported = 0;
  let skipped = 0;
  let alreadyRecorded = 0;
  let expenses = 0;

  for (const row of rows) {
    const isWithdrawal = row.amount < 0;
    if (depositsOnly && row.amount <= 0) {
      skipped++;
      continue;
    }
    const print = fingerprint(accountId || "none", row);
    if (seen.has(print)) {
      skipped++;
      continue;
    }

    // Money going out isn't rent — it's a bill. It goes to its own queue with
    // a category guessed from the description.
    if (isWithdrawal) {
      await client.collection("bank_imports").create({
        account: accountId,
        posted_date: row.posted_date,
        description: row.description,
        amount: row.amount,
        source,
        status: "expense_review",
        fingerprint: print,
      });
      seen.add(print);
      imported++;
      expenses++;
      continue;
    }

    const duplicate = paidPayments.find(
      (payment) =>
        matchScore(row.description, row.amount, {
          tenantName: payment.tenant_name ?? "",
          amount: payment.amount,
          dueDate: payment.paid_date || payment.due_date,
          postedDate: row.posted_date,
        }) >= 55
    );

    await client.collection("bank_imports").create({
      account: accountId,
      posted_date: row.posted_date,
      description: row.description,
      amount: row.amount,
      source,
      status: duplicate ? "already_recorded" : "unmatched",
      payment: duplicate?.id ?? "",
      person: duplicate?.person ?? "",
      fingerprint: print,
    });
    seen.add(print);
    imported++;
    if (duplicate) alreadyRecorded++;
  }

  refresh();
  const params = new URLSearchParams({
    imported: String(imported),
    skipped: String(skipped),
    duplicates: String(alreadyRecorded),
    expenses: String(expenses),
  });
  if (detected) params.set("account", detected);
  redirect(`/banking?${params}`);
}

/**
 * Books a withdrawal as an expense.
 *
 * The category comes from the dropdown, pre-filled with our guess; the
 * property comes from whichever account the statement belongs to, so a bill
 * paid from the Maple Street account lands against Maple Street.
 */
export async function bookImportAsExpense(form: FormData) {
  const client = await pb();
  const importId = s(form, "id");
  const deposit = await client.collection("bank_imports").getOne(importId).catch(() => null);
  if (!deposit) return;

  let propertyId = rel(form, "property_id");
  if (!propertyId && deposit.account) {
    const account = await client.collection("bank_accounts").getOne(deposit.account).catch(() => null);
    propertyId = account?.property ?? "";
  }

  await client.collection("transactions").create({
    property: propertyId,
    date: deposit.posted_date,
    type: "expense",
    category: s(form, "category") || "other",
    amount: Math.abs(deposit.amount),
    description: deposit.description,
  });
  await client.collection("bank_imports").update(importId, { status: "expense_booked" });
  refresh();
  redirect("/banking");
}

/**
 * "Yes, that's the same money."
 *
 * Confirms a suspected duplicate so it stops asking. Nothing is booked — the
 * payment was already recorded, which is the whole point.
 */
export async function confirmDuplicate(form: FormData) {
  const client = await pb();
  await client.collection("bank_imports").update(s(form, "id"), { status: "matched" });
  refresh();
  redirect("/banking");
}

export async function matchImport(form: FormData) {
  const client = await pb();
  const importId = s(form, "id");
  const paymentId = s(form, "payment_id");
  if (!paymentId) return;

  const deposit = await client.collection("bank_imports").getOne(importId).catch(() => null);
  const payment = await client.collection("payments").getOne(paymentId).catch(() => null);
  if (!deposit || !payment) return;

  await client.collection("payments").update(paymentId, {
    status: "paid",
    paid_date: deposit.posted_date,
    method: deposit.source,
  });
  await bookPaymentIncome(
    paymentId,
    deposit.posted_date,
    deposit.source,
    `Bank deposit matched — ${deposit.description}`.slice(0, 200)
  );
  await client.collection("bank_imports").update(importId, {
    status: "matched",
    payment: paymentId,
    person: payment.person || "",
  });
  await emailReceipt(paymentId, deposit.posted_date, deposit.source);
  refresh();
}

export async function bookImportAsIncome(form: FormData) {
  const client = await pb();
  const importId = s(form, "id");
  const deposit = await client.collection("bank_imports").getOne(importId).catch(() => null);
  if (!deposit) return;

  await client.collection("transactions").create({
    property: rel(form, "property_id"),
    date: deposit.posted_date,
    type: "income",
    category: s(form, "category") || "other",
    amount: deposit.amount,
    description: `Bank deposit — ${deposit.description}`.slice(0, 200),
  });
  await client.collection("bank_imports").update(importId, { status: "matched" });
  refresh();
}

export async function ignoreImport(form: FormData) {
  const client = await pb();
  await client.collection("bank_imports").update(s(form, "id"), { status: "ignored" });
  refresh();
}

export async function unignoreImport(form: FormData) {
  const client = await pb();
  await client.collection("bank_imports").update(s(form, "id"), { status: "unmatched" });
  refresh();
}

export async function clearImports(form: FormData) {
  const status = s(form, "status");
  if (status !== "ignored" && status !== "matched") return;
  const client = await pb();
  const deposits = await client
    .collection("bank_imports")
    .getFullList({ perPage: 1000, filter: `status="${status}"` });
  for (const deposit of deposits) {
    await client.collection("bank_imports").delete(deposit.id);
  }
  refresh();
}

// ---------- Maintenance ----------

export async function createMaintenance(form: FormData) {
  const client = await pb();
  await client.collection("maintenance_requests").create({
    property: rel(form, "property_id"),
    person: rel(form, "person_id"),
    title: s(form, "title"),
    description: s(form, "description"),
    priority: s(form, "priority") || "medium",
    status: "new",
  });
  refresh();
  redirect("/maintenance");
}

export async function setMaintenanceStatus(form: FormData) {
  const client = await pb();
  const status = s(form, "status");
  await client.collection("maintenance_requests").update(s(form, "id"), {
    status,
    ...(status === "completed" ? { completed_at: todayIso() } : {}),
  });
  refresh();
}

// ---------- Transactions ----------

export async function createTransaction(form: FormData) {
  const client = await pb();
  await client.collection("transactions").create({
    property: rel(form, "property_id"),
    date: s(form, "date"),
    type: s(form, "type") || "expense",
    category: s(form, "category") || "other",
    amount: n(form, "amount"),
    description: s(form, "description"),
  });
  refresh();
  redirect("/accounting");
}

// ---------- Documents ----------

export async function createDocument(form: FormData) {
  const client = await pb();
  await client.collection("documents").create({
    name: s(form, "name"),
    type: s(form, "type") || "lease",
    lease: rel(form, "lease_id"),
    property: rel(form, "property_id"),
    provider: s(form, "provider") || "manual",
    external_url: s(form, "external_url"),
    status: s(form, "status") || "draft",
  });
  refresh();
  redirect("/documents");
}

export async function setDocumentStatus(form: FormData) {
  const client = await pb();
  const status = s(form, "status");
  await client.collection("documents").update(s(form, "id"), {
    status,
    ...(status === "signed" ? { signed_at: todayIso() } : {}),
  });
  refresh();
}

// ---------- Condition reports ----------

const DEFAULT_AREAS = [
  "Entry / Hallway",
  "Living Room",
  "Kitchen",
  "Appliances",
  "Bedroom 1",
  "Bedroom 2",
  "Bathroom",
  "Walls & Ceilings",
  "Floors & Carpet",
  "Windows & Doors",
  "Smoke / CO Detectors",
  "Exterior / Yard",
];

export async function createConditionReport(form: FormData) {
  const client = await pb();
  const report = await client.collection("condition_reports").create({
    property: rel(form, "property_id"),
    lease: rel(form, "lease_id"),
    type: s(form, "type") || "move_in",
    status: "draft",
    items: DEFAULT_AREAS.map((area) => ({ area, condition: "", notes: "" })),
    notes: s(form, "notes"),
  });
  refresh();
  redirect(`/condition-reports/${report.id}`);
}

export async function updateConditionReport(form: FormData) {
  const client = await pb();
  const id = s(form, "id");
  const count = n(form, "item_count");
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      area: s(form, `area_${i}`),
      condition: s(form, `condition_${i}`),
      notes: s(form, `notes_${i}`),
    });
  }
  const complete = s(form, "action") === "complete";
  await client.collection("condition_reports").update(id, {
    items,
    notes: s(form, "report_notes"),
    status: complete ? "completed" : "draft",
    ...(complete ? { completed_at: todayIso() } : {}),
  });
  refresh();
  redirect(`/condition-reports/${id}`);
}

// ---------- Email you send on purpose ----------

/** Emails a tenant their private portal link. */
export async function sendPortalInvite(form: FormData) {
  const client = await pb();
  const person = await client.collection("people").getOne(s(form, "id")).catch(() => null);
  if (!person?.email) redirect("/contacts?mail=noaddress");

  const mail = templates.portalInvite(
    await businessName(),
    `${person.first_name} ${person.last_name}`.trim(),
    await portalUrlFor(person.portal_token)
  );
  const result = await sendEmail({ to: person.email, ...mail });
  refresh();
  redirect(`/contacts?stage=${person.stage}&mail=${result.ok ? "sent" : "failed"}`);
}

/** Emails a rent reminder (or past-due notice) for one scheduled payment. */
export async function sendPaymentReminder(form: FormData) {
  const client = await pb();
  const payment = await client.collection("payments").getOne(s(form, "id")).catch(() => null);
  if (!payment?.person) redirect("/payments?mail=noaddress");

  const person = await client.collection("people").getOne(payment.person).catch(() => null);
  if (!person?.email) redirect("/payments?mail=noaddress");

  const amount = payment.amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const mail = templates.paymentReminder(
    await businessName(),
    `${person.first_name} ${person.last_name}`.trim(),
    amount,
    payment.due_date,
    payment.due_date < todayIso(),
    await portalUrlFor(person.portal_token),
    await getSetting("payment_instructions")
  );
  const result = await sendEmail({ to: person.email, ...mail });
  refresh();
  redirect(`/payments?mail=${result.ok ? "sent" : "failed"}`);
}

/**
 * Emails every tenant a receipt for what they paid in a given month.
 * Tenants with nothing paid that month are skipped rather than sent an empty
 * receipt.
 */
export async function sendMonthlyReceipts(form: FormData) {
  const month = s(form, "month") || new Date().toISOString().slice(0, 7); // YYYY-MM
  const [payments, people, properties, units] = await Promise.all([
    listPayments(),
    listPeople("tenant"),
    listProperties(),
    listAllUnits(),
  ]);

  const business = await businessName();
  const businessAddress = await getSetting("business_address");
  const periodLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  let sent = 0;
  let skipped = 0;

  for (const tenant of people) {
    if (!tenant.email) {
      skipped++;
      continue;
    }

    const theirs = payments.filter(
      (payment) =>
        payment.status === "paid" &&
        payment.person === tenant.id &&
        (payment.paid_date ?? "").startsWith(month)
    );
    if (theirs.length === 0) {
      skipped++;
      continue;
    }

    const property = properties.find((p) => p.id === tenant.property);
    const unit = units.find((u) => u.id === tenant.unit);
    const propertyLabel =
      [property?.name, unit?.name].filter(Boolean).join(" — ") || "your rental";

    const total = theirs.reduce((sum, payment) => sum + payment.amount, 0);

    // Anything still owed for the same month, so the receipt isn't misleading.
    const outstanding = payments
      .filter(
        (payment) =>
          payment.person === tenant.id &&
          payment.status !== "paid" &&
          (payment.due_date ?? "").startsWith(month)
      )
      .reduce((sum, payment) => sum + payment.amount, 0);

    const mail = templates.monthlyReceipt({
      businessName: business,
      businessAddress,
      tenantName: `${tenant.first_name} ${tenant.last_name}`.trim(),
      propertyLabel,
      periodLabel,
      lines: theirs.map((payment) => ({
        date: payment.paid_date || payment.due_date,
        description: payment.type === "rent" ? "Rent" : payment.type.replace(/_/g, " "),
        method: payment.method || "—",
        amount: payment.amount.toLocaleString("en-US", { style: "currency", currency: "USD" }),
      })),
      total: total.toLocaleString("en-US", { style: "currency", currency: "USD" }),
      balanceNote:
        outstanding > 0
          ? `Still outstanding for ${periodLabel}: ${outstanding.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
          : undefined,
    });

    await sendEmailQuietly({ to: tenant.email, ...mail });
    sent++;
  }

  refresh();
  redirect(`/payments?receipts=${sent}&noreceipt=${skipped}`);
}

/**
 * Moves a tenant out: ends their active lease, frees the room, and files them
 * under past tenants. The one button a landlord actually reaches for when
 * someone leaves.
 */
export async function moveOutTenant(form: FormData) {
  const client = await pb();
  const personId = s(form, "id");
  const person = await client.collection("people").getOne(personId).catch(() => null);
  if (!person) return;

  const leases = await client
    .collection("leases")
    .getFullList({ perPage: 200, filter: `tenants~"${personId}"` })
    .catch(() => []);

  for (const lease of leases.filter((l) => l.status === "active" || l.status === "signed")) {
    await client.collection("leases").update(lease.id, { status: "ended" });
    if (lease.unit) {
      await client.collection("units").update(lease.unit, { status: "vacant" });
      await syncPropertyOccupancy(lease.property);
    } else if (lease.property) {
      await client.collection("properties").update(lease.property, { status: "vacant" });
    }
  }

  // Free the room even when there was no lease record to end.
  if (person.unit) {
    await client.collection("units").update(person.unit, { status: "vacant" }).catch(() => {});
    if (person.property) await syncPropertyOccupancy(person.property);
  }

  await client.collection("people").update(personId, { stage: "past", unit: "" });

  refresh();
  redirect("/contacts?stage=past&moved=1");
}

/** Sends a test message so you can prove the SMTP settings work. */
export async function sendTestEmail(form: FormData) {
  const to = s(form, "to") || (await landlordInbox());
  if (!to) redirect("/settings?mail=noaddress");
  const result = await sendEmail({ to, ...templates.test(await businessName()) });
  redirect(
    result.ok
      ? "/settings?mail=sent"
      : `/settings?mail=failed&reason=${encodeURIComponent(result.error.slice(0, 200))}`
  );
}

// ---------- Settings ----------

export async function saveSettings(form: FormData) {
  /**
   * Settings live on more than one form, so only write the keys this
   * submission actually carried — otherwise saving the payments form would
   * blank out the email settings and vice versa.
   */
  const save = async (key: string, field = key) => {
    if (form.has(field)) await setSetting(key, s(form, field));
  };

  await save("business_name");
  await save("business_address");
  for (const key of [
    "lease_late_fee", "lease_late_after_days", "lease_eviction_after_days",
    "lease_key_fee", "lease_cleaning_fee", "lease_notice_days",
    "lease_smoking_fee", "lease_detector_fee", "lease_winter_surcharge",
    "lease_winter_months", "lease_pets_allowed", "lease_house_rules", "lease_state",
  ]) {
    await save(key);
  }
  await save("payment_instructions");
  await save("payment_methods");
  await save("esign_provider");
  await save("esign_base_url");
  await save("opensign_api_url");
  await save("app_url");
  await save("smtp_host");
  await save("smtp_port");
  await save("smtp_secure");
  await save("smtp_user");
  await save("smtp_from_name");
  await save("smtp_from_email");
  await save("smtp_notify_email");

  // Secrets render empty for safety, so a blank submission keeps the stored
  // value and clearing takes an explicit checkbox.
  const token = s(form, "opensign_api_token");
  if (token) await setSetting("opensign_api_token", token);
  if (flag(form, "clear_token")) await setSetting("opensign_api_token", "");

  const smtpPassword = s(form, "smtp_password");
  if (smtpPassword) await setSetting("smtp_password", smtpPassword);
  if (flag(form, "clear_smtp_password")) await setSetting("smtp_password", "");

  refresh();
  redirect("/settings");
}
