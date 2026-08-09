"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, setSetting } from "./db";
import { listQuestions } from "./data";
import { seedDemoData } from "./seed";

function s(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function n(form: FormData, key: string): number {
  const v = Number(form.get(key));
  return Number.isFinite(v) ? v : 0;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Demo data ----------

export async function loadDemoData() {
  seedDemoData();
  refresh();
}

// ---------- Properties ----------

export async function createProperty(form: FormData) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO properties (name, address, city, state, zip, type, beds, baths, sqft, rent, deposit, description, amenities, listed, priority_listing, rental_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s(form, "name"),
      s(form, "address"),
      s(form, "city"),
      s(form, "state"),
      s(form, "zip"),
      s(form, "type"),
      n(form, "beds"),
      n(form, "baths"),
      n(form, "sqft"),
      n(form, "rent"),
      n(form, "deposit"),
      s(form, "description"),
      s(form, "amenities"),
      form.get("listed") ? 1 : 0,
      form.get("priority_listing") ? 1 : 0,
      s(form, "rental_type") === "by_room" ? "by_room" : "whole"
    );
  const propertyId = Number(result.lastInsertRowid);

  // Renting by the room? Create the rooms right away so the property is usable.
  if (s(form, "rental_type") === "by_room") {
    const rooms = Math.max(0, Math.min(20, n(form, "room_count")));
    const roomRent = n(form, "room_rent");
    const insert = db.prepare(
      "INSERT INTO units (property_id, name, rent, deposit, listed) VALUES (?, ?, ?, ?, 1)"
    );
    for (let i = 0; i < rooms; i++) {
      insert.run(propertyId, `Room ${i + 1}`, roomRent, roomRent);
    }
  }

  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function updateProperty(form: FormData) {
  const id = n(form, "id");
  getDb()
    .prepare(
      `UPDATE properties SET name=?, address=?, city=?, state=?, zip=?, type=?, beds=?, baths=?, sqft=?, rent=?, deposit=?, description=?, amenities=?, listed=?, priority_listing=?, status=?, rental_type=?
       WHERE id=?`
    )
    .run(
      s(form, "name"),
      s(form, "address"),
      s(form, "city"),
      s(form, "state"),
      s(form, "zip"),
      s(form, "type"),
      n(form, "beds"),
      n(form, "baths"),
      n(form, "sqft"),
      n(form, "rent"),
      n(form, "deposit"),
      s(form, "description"),
      s(form, "amenities"),
      form.get("listed") ? 1 : 0,
      form.get("priority_listing") ? 1 : 0,
      s(form, "status") || "vacant",
      s(form, "rental_type") === "by_room" ? "by_room" : "whole",
      id
    );
  refresh();
  redirect(`/properties/${id}`);
}

// ---------- Rooms (units) ----------

export async function createUnit(form: FormData) {
  const propertyId = n(form, "property_id");
  getDb()
    .prepare(
      `INSERT INTO units (property_id, name, rent, deposit, size_sqft, private_bath, furnished, listed, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      propertyId,
      s(form, "name") || "Room",
      n(form, "rent"),
      n(form, "deposit"),
      n(form, "size_sqft"),
      form.get("private_bath") ? 1 : 0,
      form.get("furnished") ? 1 : 0,
      form.get("listed") ? 1 : 0,
      s(form, "description")
    );
  syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

/** Adds several rooms at once — "this house has 4 bedrooms" in one step. */
export async function addRooms(form: FormData) {
  const propertyId = n(form, "property_id");
  const count = Math.max(1, Math.min(20, n(form, "count")));
  const rent = n(form, "rent");
  const deposit = n(form, "deposit");
  const db = getDb();
  const existing = db
    .prepare("SELECT COUNT(*) AS n FROM units WHERE property_id = ?")
    .get(propertyId) as { n: number };
  const insert = db.prepare(
    "INSERT INTO units (property_id, name, rent, deposit, listed) VALUES (?, ?, ?, ?, 1)"
  );
  for (let i = 0; i < count; i++) {
    insert.run(propertyId, `Room ${existing.n + i + 1}`, rent, deposit);
  }
  syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function updateUnit(form: FormData) {
  const propertyId = n(form, "property_id");
  getDb()
    .prepare(
      `UPDATE units SET name=?, rent=?, deposit=?, size_sqft=?, private_bath=?, furnished=?, listed=?, description=?, status=?
       WHERE id=?`
    )
    .run(
      s(form, "name"),
      n(form, "rent"),
      n(form, "deposit"),
      n(form, "size_sqft"),
      form.get("private_bath") ? 1 : 0,
      form.get("furnished") ? 1 : 0,
      form.get("listed") ? 1 : 0,
      s(form, "description"),
      s(form, "status") || "vacant",
      n(form, "id")
    );
  syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

export async function deleteUnit(form: FormData) {
  const db = getDb();
  const id = n(form, "id");
  const propertyId = n(form, "property_id");
  // Don't orphan people or leases pointing at this room.
  db.prepare("UPDATE people SET unit_id = NULL WHERE unit_id = ?").run(id);
  db.prepare("UPDATE leases SET unit_id = NULL WHERE unit_id = ?").run(id);
  db.prepare("DELETE FROM units WHERE id = ?").run(id);
  syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

/** Assigns (or clears) the tenant living in a room. */
export async function assignRoomTenant(form: FormData) {
  const db = getDb();
  const unitId = n(form, "unit_id");
  const propertyId = n(form, "property_id");
  const personId = n(form, "person_id");

  db.prepare("UPDATE people SET unit_id = NULL WHERE unit_id = ?").run(unitId);
  if (personId) {
    db.prepare(
      "UPDATE people SET unit_id = ?, property_id = ?, stage = 'tenant' WHERE id = ?"
    ).run(unitId, propertyId, personId);
    db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(unitId);
  } else {
    db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(unitId);
  }
  syncPropertyOccupancy(propertyId);
  refresh();
  redirect(`/properties/${propertyId}`);
}

/**
 * For a by-the-room property, the property counts as occupied when any room is
 * taken, and vacant when every room is empty.
 */
function syncPropertyOccupancy(propertyId: number) {
  if (!propertyId) return;
  const db = getDb();
  const property = db
    .prepare("SELECT rental_type FROM properties WHERE id = ?")
    .get(propertyId) as { rental_type: string } | undefined;
  if (property?.rental_type !== "by_room") return;
  const occupied = db
    .prepare("SELECT COUNT(*) AS n FROM units WHERE property_id = ? AND status = 'occupied'")
    .get(propertyId) as { n: number };
  db.prepare("UPDATE properties SET status = ? WHERE id = ?").run(
    occupied.n > 0 ? "occupied" : "vacant",
    propertyId
  );
}

export async function toggleListing(form: FormData) {
  const id = n(form, "id");
  const field = s(form, "field") === "priority_listing" ? "priority_listing" : "listed";
  getDb()
    .prepare(`UPDATE properties SET ${field} = 1 - ${field} WHERE id = ?`)
    .run(id);
  refresh();
}

// ---------- People ----------

export async function createPerson(form: FormData) {
  getDb()
    .prepare(
      `INSERT INTO people (first_name, last_name, email, phone, stage, property_id, notes, portal_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s(form, "first_name"),
      s(form, "last_name"),
      s(form, "email"),
      s(form, "phone"),
      s(form, "stage") || "lead",
      n(form, "property_id") || null,
      s(form, "notes"),
      crypto.randomUUID()
    );
  refresh();
  redirect(`/contacts?stage=${s(form, "stage") || "lead"}`);
}

export async function setPersonStage(form: FormData) {
  getDb()
    .prepare("UPDATE people SET stage = ? WHERE id = ?")
    .run(s(form, "stage"), n(form, "id"));
  refresh();
}

// ---------- Custom questions ----------

export async function createQuestion(form: FormData) {
  getDb()
    .prepare("INSERT INTO custom_questions (question, type, required) VALUES (?, ?, ?)")
    .run(s(form, "question"), s(form, "type") || "text", form.get("required") ? 1 : 0);
  refresh();
}

export async function archiveQuestion(form: FormData) {
  getDb()
    .prepare("UPDATE custom_questions SET archived = 1 WHERE id = ?")
    .run(n(form, "id"));
  refresh();
}

// ---------- Applications ----------

export async function submitApplication(form: FormData) {
  const db = getDb();
  const unitId = n(form, "unit_id") || null;
  const person = db
    .prepare(
      `INSERT INTO people (first_name, last_name, email, phone, stage, property_id, unit_id, portal_token)
       VALUES (?, ?, ?, ?, 'applicant', ?, ?, ?)`
    )
    .run(
      s(form, "first_name"),
      s(form, "last_name"),
      s(form, "email"),
      s(form, "phone"),
      n(form, "property_id") || null,
      unitId,
      crypto.randomUUID()
    );
  const answers = listQuestions().map((q) => ({
    question: q.question,
    answer: s(form, `q_${q.id}`),
  }));
  db.prepare(
    `INSERT INTO applications (person_id, property_id, unit_id, monthly_income, employer, move_in_date, answers)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(person.lastInsertRowid),
    n(form, "property_id") || null,
    unitId,
    n(form, "monthly_income"),
    s(form, "employer"),
    s(form, "move_in_date"),
    JSON.stringify(answers)
  );
  refresh();
  redirect("/apply/thanks");
}

export async function setApplicationStatus(form: FormData) {
  const db = getDb();
  const id = n(form, "id");
  const status = s(form, "status");
  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id);
  if (status === "approved") {
    const app = db
      .prepare("SELECT person_id, property_id, unit_id FROM applications WHERE id = ?")
      .get(id) as { person_id: number; property_id: number | null; unit_id: number | null } | undefined;
    if (app) {
      db.prepare(
        "UPDATE people SET stage = 'tenant', property_id = ?, unit_id = ? WHERE id = ?"
      ).run(app.property_id, app.unit_id, app.person_id);
      // Approving for a specific room fills that room.
      if (app.unit_id) {
        db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(app.unit_id);
        if (app.property_id) syncPropertyOccupancy(app.property_id);
      }
    }
  }
  refresh();
}

export async function setScreening(form: FormData) {
  getDb()
    .prepare(
      "UPDATE applications SET screening_status = ?, screening_notes = ?, screening_link = ? WHERE id = ?"
    )
    .run(
      s(form, "screening_status"),
      s(form, "screening_notes"),
      s(form, "screening_link"),
      n(form, "id")
    );
  refresh();
}

export async function toggleIncomeVerified(form: FormData) {
  getDb()
    .prepare("UPDATE applications SET income_verified = 1 - income_verified WHERE id = ?")
    .run(n(form, "id"));
  refresh();
}

// ---------- Leases ----------

export async function createLease(form: FormData) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO leases (property_id, unit_id, start_date, end_date, rent, deposit, status, esign_provider, esign_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      n(form, "property_id"),
      n(form, "unit_id") || null,
      s(form, "start_date"),
      s(form, "end_date"),
      n(form, "rent"),
      n(form, "deposit"),
      s(form, "status") || "draft",
      s(form, "esign_provider"),
      s(form, "esign_url"),
      s(form, "notes")
    );
  const leaseId = Number(result.lastInsertRowid);
  for (const key of form.getAll("tenant_ids")) {
    const pid = Number(key);
    if (pid) {
      db.prepare("INSERT OR IGNORE INTO lease_tenants (lease_id, person_id) VALUES (?, ?)").run(
        leaseId,
        pid
      );
    }
  }
  refresh();
  redirect(`/leases/${leaseId}`);
}

export async function setLeaseStatus(form: FormData) {
  const db = getDb();
  const id = n(form, "id");
  const status = s(form, "status");
  db.prepare("UPDATE leases SET status = ? WHERE id = ?").run(status, id);
  const lease = db.prepare("SELECT property_id, unit_id FROM leases WHERE id = ?").get(id) as
    | { property_id: number; unit_id: number | null }
    | undefined;
  if (lease) {
    if (status === "active") {
      db.prepare(
        `UPDATE people SET stage = 'tenant', property_id = ?, unit_id = ?
         WHERE id IN (SELECT person_id FROM lease_tenants WHERE lease_id = ?)`
      ).run(lease.property_id, lease.unit_id, id);
      if (lease.unit_id) {
        db.prepare("UPDATE units SET status = 'occupied' WHERE id = ?").run(lease.unit_id);
        syncPropertyOccupancy(lease.property_id);
      } else {
        db.prepare("UPDATE properties SET status = 'occupied' WHERE id = ?").run(lease.property_id);
      }
    }
    if (status === "ended") {
      db.prepare(
        `UPDATE people SET stage = 'past', unit_id = NULL
         WHERE id IN (SELECT person_id FROM lease_tenants WHERE lease_id = ?)`
      ).run(id);
      if (lease.unit_id) {
        db.prepare("UPDATE units SET status = 'vacant' WHERE id = ?").run(lease.unit_id);
        syncPropertyOccupancy(lease.property_id);
      } else {
        db.prepare("UPDATE properties SET status = 'vacant' WHERE id = ?").run(lease.property_id);
      }
    }
  }
  refresh();
}

// ---------- Payments ----------

export async function createPayment(form: FormData) {
  const db = getDb();
  const months = Math.max(1, Math.min(24, n(form, "repeat_months") || 1));
  const due = s(form, "due_date");
  for (let i = 0; i < months; i++) {
    const dueDate = new Date(due + "T00:00:00");
    dueDate.setMonth(dueDate.getMonth() + i);
    db.prepare(
      `INSERT INTO payments (lease_id, person_id, amount, type, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      n(form, "lease_id") || null,
      n(form, "person_id") || null,
      n(form, "amount"),
      s(form, "type") || "rent",
      dueDate.toISOString().slice(0, 10),
      s(form, "notes")
    );
  }
  refresh();
  redirect("/payments");
}

export async function markPaymentPaid(form: FormData) {
  const db = getDb();
  const id = n(form, "id");
  const method = s(form, "method") || "other";
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE payments SET status = 'paid', paid_date = ?, method = ? WHERE id = ?").run(
    today,
    method,
    id
  );
  const pay = db
    .prepare(
      `SELECT pay.amount, pay.type, l.property_id
       FROM payments pay LEFT JOIN leases l ON l.id = pay.lease_id
       WHERE pay.id = ?`
    )
    .get(id) as { amount: number; type: string; property_id: number | null } | undefined;
  if (pay) {
    db.prepare(
      `INSERT INTO transactions (property_id, date, type, category, amount, description, payment_id)
       VALUES (?, ?, 'income', ?, ?, ?, ?)`
    ).run(
      pay.property_id,
      today,
      pay.type === "rent" ? "rent" : pay.type,
      pay.amount,
      `Payment received (${method})`,
      id
    );
  }
  refresh();
}

export async function deletePayment(form: FormData) {
  getDb().prepare("DELETE FROM payments WHERE id = ? AND status = 'unpaid'").run(n(form, "id"));
  refresh();
}

// ---------- Tenant portal (token-authenticated) ----------

function personIdForToken(token: string): number | null {
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT id FROM people WHERE portal_token = ?")
    .get(token) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function portalReportPayment(form: FormData) {
  const token = s(form, "token");
  const personId = personIdForToken(token);
  if (!personId) return;
  const paymentId = n(form, "payment_id");
  // The payment must belong to this tenant directly or via one of their leases.
  getDb()
    .prepare(
      `UPDATE payments
       SET status = 'reported', reported_method = ?, reported_date = ?, reported_note = ?
       WHERE id = ? AND status = 'unpaid'
         AND (person_id = ? OR lease_id IN (SELECT lease_id FROM lease_tenants WHERE person_id = ?))`
    )
    .run(
      s(form, "reported_method") || "other",
      s(form, "reported_date") || new Date().toISOString().slice(0, 10),
      s(form, "reported_note"),
      paymentId,
      personId,
      personId
    );
  refresh();
  redirect(`/portal/${token}`);
}

export async function portalCreateMaintenance(form: FormData) {
  const token = s(form, "token");
  const person = getDb()
    .prepare("SELECT id, property_id FROM people WHERE portal_token = ?")
    .get(token) as { id: number; property_id: number | null } | undefined;
  if (!person) return;
  const propertyId = person.property_id ?? n(form, "property_id");
  if (!propertyId) return;
  getDb()
    .prepare(
      `INSERT INTO maintenance_requests (property_id, person_id, title, description, priority)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(propertyId, person.id, s(form, "title"), s(form, "description"), s(form, "priority") || "medium");
  refresh();
  redirect(`/portal/${token}`);
}

export async function approveReportedPayment(form: FormData) {
  const db = getDb();
  const id = n(form, "id");
  const pay = db
    .prepare(
      `SELECT pay.amount, pay.type, pay.reported_method, pay.reported_date, l.property_id
       FROM payments pay LEFT JOIN leases l ON l.id = pay.lease_id
       WHERE pay.id = ? AND pay.status = 'reported'`
    )
    .get(id) as
    | { amount: number; type: string; reported_method: string; reported_date: string; property_id: number | null }
    | undefined;
  if (!pay) return;
  const paidDate = pay.reported_date || new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE payments SET status = 'paid', paid_date = ?, method = ? WHERE id = ?").run(
    paidDate,
    pay.reported_method || "other",
    id
  );
  db.prepare(
    `INSERT INTO transactions (property_id, date, type, category, amount, description, payment_id)
     VALUES (?, ?, 'income', ?, ?, ?, ?)`
  ).run(
    pay.property_id,
    paidDate,
    pay.type === "rent" ? "rent" : pay.type,
    pay.amount,
    `Tenant-reported payment approved (${pay.reported_method || "other"})`,
    id
  );
  refresh();
}

export async function rejectReportedPayment(form: FormData) {
  getDb()
    .prepare(
      `UPDATE payments
       SET status = 'unpaid', reported_method = '', reported_date = '', reported_note = ''
       WHERE id = ? AND status = 'reported'`
    )
    .run(n(form, "id"));
  refresh();
}

// ---------- Maintenance ----------

export async function createMaintenance(form: FormData) {
  getDb()
    .prepare(
      `INSERT INTO maintenance_requests (property_id, person_id, title, description, priority)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      n(form, "property_id"),
      n(form, "person_id") || null,
      s(form, "title"),
      s(form, "description"),
      s(form, "priority") || "medium"
    );
  refresh();
  redirect("/maintenance");
}

export async function setMaintenanceStatus(form: FormData) {
  const status = s(form, "status");
  getDb()
    .prepare(
      `UPDATE maintenance_requests
       SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END
       WHERE id = ?`
    )
    .run(status, status, n(form, "id"));
  refresh();
}

// ---------- Transactions ----------

export async function createTransaction(form: FormData) {
  getDb()
    .prepare(
      `INSERT INTO transactions (property_id, date, type, category, amount, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      n(form, "property_id") || null,
      s(form, "date"),
      s(form, "type") || "expense",
      s(form, "category") || "other",
      n(form, "amount"),
      s(form, "description")
    );
  refresh();
  redirect("/accounting");
}

// ---------- Documents ----------

export async function createDocument(form: FormData) {
  getDb()
    .prepare(
      `INSERT INTO documents (name, type, lease_id, property_id, provider, external_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s(form, "name"),
      s(form, "type") || "lease",
      n(form, "lease_id") || null,
      n(form, "property_id") || null,
      s(form, "provider") || "manual",
      s(form, "external_url"),
      s(form, "status") || "draft"
    );
  refresh();
  redirect("/documents");
}

export async function setDocumentStatus(form: FormData) {
  const status = s(form, "status");
  getDb()
    .prepare(
      `UPDATE documents
       SET status = ?, signed_at = CASE WHEN ? = 'signed' THEN datetime('now') ELSE signed_at END
       WHERE id = ?`
    )
    .run(status, status, n(form, "id"));
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
  const items = DEFAULT_AREAS.map((area) => ({ area, condition: "", notes: "" }));
  const result = getDb()
    .prepare(
      `INSERT INTO condition_reports (property_id, lease_id, type, items, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      n(form, "property_id"),
      n(form, "lease_id") || null,
      s(form, "type") || "move_in",
      JSON.stringify(items),
      s(form, "notes")
    );
  refresh();
  redirect(`/condition-reports/${result.lastInsertRowid}`);
}

export async function updateConditionReport(form: FormData) {
  const id = n(form, "id");
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
  getDb()
    .prepare(
      `UPDATE condition_reports
       SET items = ?, notes = ?, status = ?,
           completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END
       WHERE id = ?`
    )
    .run(JSON.stringify(items), s(form, "report_notes"), complete ? "completed" : "draft", complete ? 1 : 0, id);
  refresh();
  redirect(`/condition-reports/${id}`);
}

// ---------- Settings ----------

export async function saveSettings(form: FormData) {
  setSetting("business_name", s(form, "business_name"));
  setSetting("payment_instructions", s(form, "payment_instructions"));
  setSetting("payment_methods", s(form, "payment_methods"));
  setSetting("esign_provider", s(form, "esign_provider"));
  setSetting("esign_base_url", s(form, "esign_base_url"));
  refresh();
  redirect("/settings");
}
