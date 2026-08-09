import { getDb, setSetting } from "./db";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthsAgo(months: number, day = 1): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - months, day);
}

/** Populates the database with realistic demo data so new users can explore
 *  every module. Safe to call only on an empty database. */
export function seedDemoData() {
  const db = getDb();
  const existing = db.prepare("SELECT COUNT(*) AS n FROM properties").get() as { n: number };
  if (existing.n > 0) return;

  const insertProperty = db.prepare(
    `INSERT INTO properties (name, address, city, state, zip, type, beds, baths, sqft, rent, deposit, status, listed, priority_listing, description, amenities)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const maple = Number(
    insertProperty.run(
      "Maple Street House", "412 Maple St", "Columbus", "OH", "43004",
      "single_family", 3, 2, 1650, 1850, 1850, "occupied", 0, 0,
      "Charming 3-bed home with a fenced backyard and updated kitchen.",
      "Washer/Dryer, Garage, Fenced Yard, Central A/C"
    ).lastInsertRowid
  );
  const oak = Number(
    insertProperty.run(
      "Oakwood Apartments #2B", "88 Oakwood Ave, Unit 2B", "Columbus", "OH", "43201",
      "apartment", 2, 1, 900, 1250, 1250, "occupied", 0, 0,
      "Bright 2-bed apartment near campus, water included.",
      "Water Included, On-site Laundry, Parking"
    ).lastInsertRowid
  );
  const cedar = Number(
    insertProperty.run(
      "Cedar Duplex - Unit A", "17 Cedar Ln, Unit A", "Westerville", "OH", "43081",
      "duplex", 2, 1.5, 1100, 1450, 1450, "vacant", 1, 1,
      "Renovated duplex unit with new flooring and stainless appliances. Available now!",
      "New Appliances, Pet Friendly, Off-street Parking"
    ).lastInsertRowid
  );
  const birch = Number(
    insertProperty.run(
      "Birch Condo 5F", "230 Birch Blvd, 5F", "Columbus", "OH", "43215",
      "condo", 1, 1, 720, 1150, 1150, "vacant", 1, 0,
      "Downtown condo with skyline views, gym and rooftop access.",
      "Gym, Rooftop, Dishwasher, In-unit Laundry"
    ).lastInsertRowid
  );

  // A house rented out room by room — the co-living / rent-by-the-room case.
  const willow = Number(
    insertProperty.run(
      "Willow House (by the room)", "905 Willow Dr", "Columbus", "OH", "43206",
      "single_family", 4, 2, 2100, 0, 0, "occupied", 1, 0,
      "Rooms for rent in a shared 4-bedroom house. Utilities and wifi included.",
      "Wifi Included, Utilities Included, Shared Kitchen, Laundry, Backyard"
    ).lastInsertRowid
  );
  db.prepare("UPDATE properties SET rental_type = 'by_room' WHERE id = ?").run(willow);
  const insertUnit = db.prepare(
    `INSERT INTO units (property_id, name, rent, deposit, status, size_sqft, private_bath, furnished, listed, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const room1 = Number(insertUnit.run(willow, "Room 1 — Master", 850, 850, "occupied", 220, 1, 1, "Largest room, private ensuite bath.").lastInsertRowid);
  const room2 = Number(insertUnit.run(willow, "Room 2", 700, 700, "occupied", 160, 0, 1, "Furnished, shared hall bath.").lastInsertRowid);
  const room3 = Number(insertUnit.run(willow, "Room 3", 675, 675, "vacant", 150, 0, 1, "Bright corner room, available now.").lastInsertRowid);
  const room4 = Number(insertUnit.run(willow, "Room 4", 650, 650, "vacant", 140, 0, 0, "Unfurnished, quiet side of the house.").lastInsertRowid);

  const insertPerson = db.prepare(
    `INSERT INTO people (first_name, last_name, email, phone, stage, property_id, notes, portal_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const token = () => crypto.randomUUID();
  const marcus = Number(
    insertPerson.run("Marcus", "Webb", "marcus.webb@example.com", "(614) 555-0121", "tenant", maple,
      "Great tenant, always pays on time.", token()).lastInsertRowid
  );
  const dana = Number(
    insertPerson.run("Dana", "Liu", "dana.liu@example.com", "(614) 555-0177", "tenant", oak,
      "Renewed lease last spring.", token()).lastInsertRowid
  );
  const priya = Number(
    insertPerson.run("Priya", "Sharma", "priya.s@example.com", "(614) 555-0163", "applicant", cedar,
      "Applied for Cedar Duplex. Screening in progress.", token()).lastInsertRowid
  );
  insertPerson.run("Jordan", "Ellis", "jordan.e@example.com", "(614) 555-0142", "lead", cedar,
    "Asked about pet policy via listing page.", token());
  insertPerson.run("Sam", "Okafor", "sam.okafor@example.com", "(614) 555-0198", "lead", birch,
    "Wants a tour next weekend.", token());
  insertPerson.run("Rita", "Alvarez", "rita.alv@example.com", "(614) 555-0110", "past", null,
    "Moved out of Cedar Duplex in good standing.", token());

  // Room tenants at Willow House.
  const insertRoomTenant = db.prepare(
    `INSERT INTO people (first_name, last_name, email, phone, stage, property_id, unit_id, notes, portal_token)
     VALUES (?, ?, ?, ?, 'tenant', ?, ?, ?, ?)`
  );
  const theo = Number(
    insertRoomTenant.run("Theo", "Nguyen", "theo.n@example.com", "(614) 555-0134", willow, room1,
      "Rents the master room.", token()).lastInsertRowid
  );
  const amara = Number(
    insertRoomTenant.run("Amara", "Bello", "amara.b@example.com", "(614) 555-0156", willow, room2,
      "Rents Room 2.", token()).lastInsertRowid
  );

  const insertQuestion = db.prepare(
    "INSERT INTO custom_questions (question, type, required) VALUES (?, ?, ?)"
  );
  insertQuestion.run("Do you have pets? If yes, what kind?", "text", 1);
  insertQuestion.run("Have you ever been evicted?", "yesno", 1);
  insertQuestion.run("How many people will live in the unit?", "number", 1);
  insertQuestion.run("Do you smoke?", "yesno", 0);

  db.prepare(
    `INSERT INTO applications (person_id, property_id, status, monthly_income, employer, income_verified, screening_status, screening_notes, answers, move_in_date)
     VALUES (?, ?, 'screening', 5400, 'Riverside Health', 1, 'requested', 'Credit + background report requested.', ?, ?)`
  ).run(
    priya, cedar,
    JSON.stringify([
      { question: "Do you have pets? If yes, what kind?", answer: "One cat, 4 years old" },
      { question: "Have you ever been evicted?", answer: "No" },
      { question: "How many people will live in the unit?", answer: "2" },
      { question: "Do you smoke?", answer: "No" },
    ]),
    iso(monthsAgo(-1, 1))
  );

  const insertLease = db.prepare(
    `INSERT INTO leases (property_id, unit_id, start_date, end_date, rent, deposit, status, esign_provider, esign_url)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertRoomLease = db.prepare(
    `INSERT INTO leases (property_id, unit_id, start_date, end_date, rent, deposit, status, esign_provider, esign_url)
     VALUES (?, ?, ?, ?, ?, ?, 'active', '', '')`
  );
  const mapleLease = Number(
    insertLease.run(maple, iso(monthsAgo(7, 1)), iso(monthsAgo(-5, 1)), 1850, 1850, "active", "documenso", "").lastInsertRowid
  );
  const oakLease = Number(
    insertLease.run(oak, iso(monthsAgo(5, 1)), iso(monthsAgo(-2, 28)), 1250, 1250, "active", "docuseal", "").lastInsertRowid
  );
  const cedarLease = Number(
    insertLease.run(cedar, iso(monthsAgo(-1, 1)), iso(monthsAgo(-13, 1)), 1450, 1450, "draft", "", "").lastInsertRowid
  );
  const theoLease = Number(
    insertRoomLease.run(willow, room1, iso(monthsAgo(4, 1)), iso(monthsAgo(-8, 1)), 850, 850).lastInsertRowid
  );
  const amaraLease = Number(
    insertRoomLease.run(willow, room2, iso(monthsAgo(2, 1)), iso(monthsAgo(-10, 1)), 700, 700).lastInsertRowid
  );

  const linkTenant = db.prepare("INSERT INTO lease_tenants (lease_id, person_id) VALUES (?, ?)");
  linkTenant.run(mapleLease, marcus);
  linkTenant.run(oakLease, dana);
  linkTenant.run(cedarLease, priya);
  linkTenant.run(theoLease, theo);
  linkTenant.run(amaraLease, amara);

  const insertPayment = db.prepare(
    `INSERT INTO payments (lease_id, person_id, amount, type, due_date, paid_date, method, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTxn = db.prepare(
    `INSERT INTO transactions (property_id, date, type, category, amount, description, payment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  // Paid rent history for the last 6 months (feeds the insights chart).
  for (let m = 6; m >= 1; m--) {
    const due = monthsAgo(m, 1);
    const paidMaple = monthsAgo(m, m === 3 ? 4 : 1);
    const payMaple = Number(
      insertPayment.run(mapleLease, marcus, 1850, "rent", iso(due), iso(paidMaple), "ach", "paid", "").lastInsertRowid
    );
    insertTxn.run(maple, iso(paidMaple), "income", "rent", 1850, "Rent — Maple Street House", payMaple);
    if (m <= 5) {
      const paidOak = monthsAgo(m, 2);
      const payOak = Number(
        insertPayment.run(oakLease, dana, 1250, "rent", iso(due), iso(paidOak), "zelle", "paid", "").lastInsertRowid
      );
      insertTxn.run(oak, iso(paidOak), "income", "rent", 1250, "Rent — Oakwood Apartments #2B", payOak);
    }
  }

  // This month: Maple paid, Oakwood past due, next month upcoming for both.
  const thisMonth = monthsAgo(0, 1);
  const payThis = Number(
    insertPayment.run(mapleLease, marcus, 1850, "rent", iso(thisMonth), iso(monthsAgo(0, 2)), "ach", "paid", "").lastInsertRowid
  );
  insertTxn.run(maple, iso(monthsAgo(0, 2)), "income", "rent", 1850, "Rent — Maple Street House", payThis);
  insertPayment.run(oakLease, dana, 1250, "rent", iso(thisMonth), null, "", "unpaid", "Reminder sent");
  // Tenant reported this one from the portal — awaiting landlord approval.
  db.prepare(
    `INSERT INTO payments (lease_id, person_id, amount, type, due_date, status, reported_method, reported_date, reported_note, notes)
     VALUES (?, ?, 75, 'late_fee', ?, 'reported', 'zelle', ?, 'Sent via Zelle this morning — conf #Z8841', '')`
  ).run(oakLease, dana, iso(monthsAgo(0, 6)), iso(monthsAgo(0, 8)));
  const nextMonth = monthsAgo(-1, 1);
  insertPayment.run(mapleLease, marcus, 1850, "rent", iso(nextMonth), null, "", "unpaid", "");
  insertPayment.run(oakLease, dana, 1250, "rent", iso(nextMonth), null, "", "unpaid", "");

  // Room rent at Willow House: paid history plus this month.
  for (let m = 3; m >= 0; m--) {
    const due = monthsAgo(m, 1);
    if (m > 0) {
      const paidTheo = monthsAgo(m, 1);
      const p1 = Number(
        insertPayment.run(theoLease, theo, 850, "rent", iso(due), iso(paidTheo), "ach", "paid", "").lastInsertRowid
      );
      insertTxn.run(willow, iso(paidTheo), "income", "rent", 850, "Rent — Willow House Room 1", p1);
      if (m <= 2) {
        const paidAmara = monthsAgo(m, 3);
        const p2 = Number(
          insertPayment.run(amaraLease, amara, 700, "rent", iso(due), iso(paidAmara), "venmo", "paid", "").lastInsertRowid
        );
        insertTxn.run(willow, iso(paidAmara), "income", "rent", 700, "Rent — Willow House Room 2", p2);
      }
    } else {
      const paidTheo = monthsAgo(0, 2);
      const p1 = Number(
        insertPayment.run(theoLease, theo, 850, "rent", iso(due), iso(paidTheo), "ach", "paid", "").lastInsertRowid
      );
      insertTxn.run(willow, iso(paidTheo), "income", "rent", 850, "Rent — Willow House Room 1", p1);
      insertPayment.run(amaraLease, amara, 700, "rent", iso(due), null, "", "unpaid", "");
    }
  }

  // Expenses.
  insertTxn.run(maple, iso(monthsAgo(4, 12)), "expense", "repairs", 320, "Water heater repair", null);
  insertTxn.run(oak, iso(monthsAgo(3, 20)), "expense", "utilities", 95, "Water bill (owner paid)", null);
  insertTxn.run(cedar, iso(monthsAgo(2, 8)), "expense", "turnover", 780, "Paint + new flooring for turnover", null);
  insertTxn.run(maple, iso(monthsAgo(1, 15)), "expense", "insurance", 410, "Landlord insurance premium", null);
  insertTxn.run(null, iso(monthsAgo(0, 3)), "expense", "software", 0, "OpenTenant subscription — free forever", null);

  const insertMaint = db.prepare(
    `INSERT INTO maintenance_requests (property_id, person_id, title, description, priority, status, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertMaint.run(oak, dana, "Kitchen faucet dripping", "Slow drip from the kitchen faucet, getting worse.", "medium", "new", iso(monthsAgo(0, 3)), null);
  insertMaint.run(maple, marcus, "Furnace making noise", "Rattling sound when the heat kicks on.", "high", "in_progress", iso(monthsAgo(0, 1)), null);
  insertMaint.run(maple, marcus, "Gutter cleaning", "Requested seasonal gutter cleaning.", "low", "completed", iso(monthsAgo(2, 10)), iso(monthsAgo(2, 14)));

  const insertDoc = db.prepare(
    `INSERT INTO documents (name, type, lease_id, property_id, status, provider, external_url, signed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertDoc.run("Maple St Lease 2025-2026", "lease", mapleLease, maple, "signed", "documenso", "", iso(monthsAgo(7, 3)));
  insertDoc.run("Oakwood 2B Lease Renewal", "lease", oakLease, oak, "signed", "docuseal", "", iso(monthsAgo(5, 2)));
  insertDoc.run("Cedar Duplex Lease (Priya Sharma)", "lease", cedarLease, cedar, "sent", "documenso", "", null);
  insertDoc.run("Pet Addendum — Cedar Duplex", "addendum", cedarLease, cedar, "draft", "manual", "", null);

  db.prepare(
    `INSERT INTO condition_reports (property_id, lease_id, type, status, items, notes, completed_at)
     VALUES (?, ?, 'move_in', 'completed', ?, 'Completed with tenant at move-in.', ?)`
  ).run(
    maple, mapleLease,
    JSON.stringify([
      { area: "Entry / Hallway", condition: "good", notes: "" },
      { area: "Living Room", condition: "good", notes: "Small nail holes patched" },
      { area: "Kitchen", condition: "good", notes: "" },
      { area: "Appliances", condition: "fair", notes: "Fridge shelf cracked" },
      { area: "Bedroom 1", condition: "good", notes: "" },
      { area: "Bedroom 2", condition: "good", notes: "" },
      { area: "Bathroom", condition: "good", notes: "Recaulked tub" },
      { area: "Walls & Ceilings", condition: "good", notes: "" },
      { area: "Floors & Carpet", condition: "fair", notes: "Carpet worn in hallway" },
      { area: "Windows & Doors", condition: "good", notes: "" },
      { area: "Smoke / CO Detectors", condition: "good", notes: "New batteries installed" },
      { area: "Exterior / Yard", condition: "good", notes: "" },
    ]),
    iso(monthsAgo(7, 1))
  );

  db.prepare(
    `INSERT INTO condition_reports (property_id, lease_id, type, status, items, notes)
     VALUES (?, ?, 'move_in', 'draft', '[]', 'To complete before Priya moves in.')`
  ).run(cedar, cedarLease);

  const insertAccount = db.prepare(
    `INSERT INTO bank_accounts (name, institution, last4, kind, property_id, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const rentChecking = Number(
    insertAccount.run("Rent checking", "First National", "4821", "bank", null,
      "Main account — most rent lands here.").lastInsertRowid
  );
  insertAccount.run("Zelle (personal)", "First National", "4821", "zelle", oak,
    "Oakwood tenants pay by Zelle.");
  insertAccount.run("Willow House account", "Credit Union", "2210", "bank", willow,
    "Room rent for the shared house.");

  // Two deposits waiting to be matched, so the review flow has something in it.
  const insertImport = db.prepare(
    `INSERT INTO bank_imports (account_id, posted_date, description, amount, source, status, fingerprint)
     VALUES (?, ?, ?, ?, ?, 'unmatched', ?)`
  );
  insertImport.run(rentChecking, iso(monthsAgo(0, 4)), "ZELLE FROM MARCUS WEBB SEPT RENT", 1850, "zelle", "demo-1");
  insertImport.run(rentChecking, iso(monthsAgo(0, 5)), "ACH DEPOSIT — CITY UTILITY REFUND", 63.4, "bank", "demo-2");

  setSetting("business_name", "Demo Property Management");
  setSetting("payment_methods", "ACH transfer, Zelle, Venmo, Check");
  setSetting(
    "payment_instructions",
    "Zelle: payments@demo-pm.example — include your unit in the memo.\nChecks payable to Demo Property Management, mailed to PO Box 100, Columbus OH."
  );
  setSetting("esign_provider", "documenso");
}
