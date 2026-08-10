import { pb } from "./pb";
import { setSetting } from "./data";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthsAgo(months: number, day = 1): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, day);
}

/**
 * Fills a fresh install with realistic demo data so every module has something
 * to show. Does nothing once any property exists.
 */
export async function seedDemoData(): Promise<void> {
  const client = await pb();
  const existing = await client.collection("properties").getFullList({ perPage: 1 });
  if (existing.length > 0) return;

  const token = () => crypto.randomUUID();
  const property = (data: Record<string, unknown>) =>
    client.collection("properties").create(data);

  const maple = await property({
    name: "Maple Street House", address: "412 Maple St", city: "Columbus", state: "OH", zip: "43004",
    type: "single_family", beds: 3, baths: 2, sqft: 1650, rent: 1850, deposit: 1850,
    status: "occupied", listed: false, priority_listing: false, rental_type: "whole",
    description: "Charming 3-bed home with a fenced backyard and updated kitchen.",
    amenities: "Washer/Dryer, Garage, Fenced Yard, Central A/C",
  });
  const oak = await property({
    name: "Oakwood Apartments #2B", address: "88 Oakwood Ave, Unit 2B", city: "Columbus", state: "OH", zip: "43201",
    type: "apartment", beds: 2, baths: 1, sqft: 900, rent: 1250, deposit: 1250,
    status: "occupied", listed: false, priority_listing: false, rental_type: "whole",
    description: "Bright 2-bed apartment near campus, water included.",
    amenities: "Water Included, On-site Laundry, Parking",
  });
  const cedar = await property({
    name: "Cedar Duplex - Unit A", address: "17 Cedar Ln, Unit A", city: "Westerville", state: "OH", zip: "43081",
    type: "duplex", beds: 2, baths: 1.5, sqft: 1100, rent: 1450, deposit: 1450,
    status: "vacant", listed: true, priority_listing: true, rental_type: "whole",
    description: "Renovated duplex unit with new flooring and stainless appliances. Available now!",
    amenities: "New Appliances, Pet Friendly, Off-street Parking",
  });
  await property({
    name: "Birch Condo 5F", address: "230 Birch Blvd, 5F", city: "Columbus", state: "OH", zip: "43215",
    type: "condo", beds: 1, baths: 1, sqft: 720, rent: 1150, deposit: 1150,
    status: "vacant", listed: true, priority_listing: false, rental_type: "whole",
    description: "Downtown condo with skyline views, gym and rooftop access.",
    amenities: "Gym, Rooftop, Dishwasher, In-unit Laundry",
  });

  // A house rented out room by room.
  const willow = await property({
    name: "Willow House (by the room)", address: "905 Willow Dr", city: "Columbus", state: "OH", zip: "43206",
    type: "single_family", beds: 4, baths: 2, sqft: 2100, rent: 0, deposit: 0,
    status: "occupied", listed: true, priority_listing: false, rental_type: "by_room",
    description: "Rooms for rent in a shared 4-bedroom house. Utilities and wifi included.",
    amenities: "Wifi Included, Utilities Included, Shared Kitchen, Laundry, Backyard",
  });

  const unit = (data: Record<string, unknown>) => client.collection("units").create(data);
  const room1 = await unit({ property: willow.id, name: "Room 1 — Master", rent: 850, deposit: 850, status: "occupied", size_sqft: 220, private_bath: true, furnished: true, listed: true, description: "Largest room, private ensuite bath." });
  const room2 = await unit({ property: willow.id, name: "Room 2", rent: 700, deposit: 700, status: "occupied", size_sqft: 160, private_bath: false, furnished: true, listed: true, description: "Furnished, shared hall bath." });
  await unit({ property: willow.id, name: "Room 3", rent: 675, deposit: 675, status: "vacant", size_sqft: 150, private_bath: false, furnished: true, listed: true, description: "Bright corner room, available now." });
  await unit({ property: willow.id, name: "Room 4", rent: 650, deposit: 650, status: "vacant", size_sqft: 140, private_bath: false, furnished: false, listed: true, description: "Unfurnished, quiet side of the house." });

  const person = (data: Record<string, unknown>) =>
    client.collection("people").create({ portal_token: token(), ...data });

  const marcus = await person({ first_name: "Marcus", last_name: "Webb", email: "marcus.webb@example.com", phone: "(614) 555-0121", stage: "tenant", property: maple.id, notes: "Great tenant, always pays on time." });
  const dana = await person({ first_name: "Dana", last_name: "Liu", email: "dana.liu@example.com", phone: "(614) 555-0177", stage: "tenant", property: oak.id, notes: "Renewed lease last spring." });
  const priya = await person({ first_name: "Priya", last_name: "Sharma", email: "priya.s@example.com", phone: "(614) 555-0163", stage: "applicant", property: cedar.id, notes: "Applied for Cedar Duplex. Screening in progress." });
  await person({ first_name: "Jordan", last_name: "Ellis", email: "jordan.e@example.com", phone: "(614) 555-0142", stage: "lead", property: cedar.id, notes: "Asked about pet policy via listing page." });
  await person({ first_name: "Sam", last_name: "Okafor", email: "sam.okafor@example.com", phone: "(614) 555-0198", stage: "lead", notes: "Wants a tour next weekend." });
  await person({ first_name: "Rita", last_name: "Alvarez", email: "rita.alv@example.com", phone: "(614) 555-0110", stage: "past", notes: "Moved out of Cedar Duplex in good standing." });
  const theo = await person({ first_name: "Theo", last_name: "Nguyen", email: "theo.n@example.com", phone: "(614) 555-0134", stage: "tenant", property: willow.id, unit: room1.id, notes: "Rents the master room." });
  const amara = await person({ first_name: "Amara", last_name: "Bello", email: "amara.b@example.com", phone: "(614) 555-0156", stage: "tenant", property: willow.id, unit: room2.id, notes: "Rents Room 2." });

  const question = (question: string, type: string, required: boolean) =>
    client.collection("custom_questions").create({ question, type, required, archived: false });
  await question("Do you have pets? If yes, what kind?", "text", true);
  await question("Have you ever been evicted?", "yesno", true);
  await question("How many people will live in the unit?", "number", true);
  await question("Do you smoke?", "yesno", false);

  await client.collection("applications").create({
    person: priya.id, property: cedar.id, status: "screening",
    monthly_income: 5400, employer: "Riverside Health", income_verified: true,
    screening_status: "requested", screening_notes: "Credit + background report requested.",
    move_in_date: iso(monthsAgo(-1, 1)),
    answers: [
      { question: "Do you have pets? If yes, what kind?", answer: "One cat, 4 years old" },
      { question: "Have you ever been evicted?", answer: "No" },
      { question: "How many people will live in the unit?", answer: "2" },
      { question: "Do you smoke?", answer: "No" },
    ],
  });

  const lease = (data: Record<string, unknown>) => client.collection("leases").create(data);
  const mapleLease = await lease({ property: maple.id, tenants: [marcus.id], start_date: iso(monthsAgo(7, 1)), end_date: iso(monthsAgo(-5, 1)), rent: 1850, deposit: 1850, status: "active", esign_provider: "opensign" });
  const oakLease = await lease({ property: oak.id, tenants: [dana.id], start_date: iso(monthsAgo(5, 1)), end_date: iso(monthsAgo(-2, 28)), rent: 1250, deposit: 1250, status: "active", esign_provider: "opensign" });
  const cedarLease = await lease({ property: cedar.id, tenants: [priya.id], start_date: iso(monthsAgo(-1, 1)), end_date: iso(monthsAgo(-13, 1)), rent: 1450, deposit: 1450, status: "draft" });
  const theoLease = await lease({ property: willow.id, unit: room1.id, tenants: [theo.id], start_date: iso(monthsAgo(4, 1)), end_date: iso(monthsAgo(-8, 1)), rent: 850, deposit: 850, status: "active" });
  const amaraLease = await lease({ property: willow.id, unit: room2.id, tenants: [amara.id], start_date: iso(monthsAgo(2, 1)), end_date: iso(monthsAgo(-10, 1)), rent: 700, deposit: 700, status: "active" });

  const payment = (data: Record<string, unknown>) => client.collection("payments").create(data);
  const txn = (data: Record<string, unknown>) => client.collection("transactions").create(data);

  // Six months of collected rent, so the insights chart has history.
  for (let m = 6; m >= 1; m--) {
    const due = iso(monthsAgo(m, 1));
    const paidMaple = iso(monthsAgo(m, m === 3 ? 4 : 1));
    const p1 = await payment({ lease: mapleLease.id, person: marcus.id, amount: 1850, type: "rent", due_date: due, paid_date: paidMaple, method: "ach", status: "paid" });
    await txn({ property: maple.id, date: paidMaple, type: "income", category: "rent", amount: 1850, description: "Rent — Maple Street House", payment: p1.id });

    if (m <= 5) {
      const paidOak = iso(monthsAgo(m, 2));
      const p2 = await payment({ lease: oakLease.id, person: dana.id, amount: 1250, type: "rent", due_date: due, paid_date: paidOak, method: "zelle", status: "paid" });
      await txn({ property: oak.id, date: paidOak, type: "income", category: "rent", amount: 1250, description: "Rent — Oakwood Apartments #2B", payment: p2.id });
    }
    if (m <= 3) {
      const paidTheo = iso(monthsAgo(m, 1));
      const p3 = await payment({ lease: theoLease.id, person: theo.id, amount: 850, type: "rent", due_date: due, paid_date: paidTheo, method: "ach", status: "paid" });
      await txn({ property: willow.id, date: paidTheo, type: "income", category: "rent", amount: 850, description: "Rent — Willow House Room 1", payment: p3.id });
    }
    if (m <= 2) {
      const paidAmara = iso(monthsAgo(m, 3));
      const p4 = await payment({ lease: amaraLease.id, person: amara.id, amount: 700, type: "rent", due_date: due, paid_date: paidAmara, method: "venmo", status: "paid" });
      await txn({ property: willow.id, date: paidAmara, type: "income", category: "rent", amount: 700, description: "Rent — Willow House Room 2", payment: p4.id });
    }
  }

  // This month: some paid, one past due, one waiting on the landlord's approval.
  const thisMonth = iso(monthsAgo(0, 1));
  const paidNow = iso(monthsAgo(0, 2));
  const current = await payment({ lease: mapleLease.id, person: marcus.id, amount: 1850, type: "rent", due_date: thisMonth, paid_date: paidNow, method: "ach", status: "paid" });
  await txn({ property: maple.id, date: paidNow, type: "income", category: "rent", amount: 1850, description: "Rent — Maple Street House", payment: current.id });
  await payment({ lease: theoLease.id, person: theo.id, amount: 850, type: "rent", due_date: thisMonth, paid_date: paidNow, method: "ach", status: "paid" });
  await payment({ lease: oakLease.id, person: dana.id, amount: 1250, type: "rent", due_date: thisMonth, status: "unpaid", notes: "Reminder sent" });
  await payment({ lease: amaraLease.id, person: amara.id, amount: 700, type: "rent", due_date: thisMonth, status: "unpaid" });
  await payment({
    lease: oakLease.id, person: dana.id, amount: 75, type: "late_fee", due_date: iso(monthsAgo(0, 6)),
    status: "reported", reported_method: "zelle", reported_date: iso(monthsAgo(0, 8)),
    reported_note: "Sent via Zelle this morning — conf #Z8841",
  });

  const nextMonth = iso(monthsAgo(-1, 1));
  await payment({ lease: mapleLease.id, person: marcus.id, amount: 1850, type: "rent", due_date: nextMonth, status: "unpaid" });
  await payment({ lease: oakLease.id, person: dana.id, amount: 1250, type: "rent", due_date: nextMonth, status: "unpaid" });

  await txn({ property: maple.id, date: iso(monthsAgo(4, 12)), type: "expense", category: "repairs", amount: 320, description: "Water heater repair" });
  await txn({ property: oak.id, date: iso(monthsAgo(3, 20)), type: "expense", category: "utilities", amount: 95, description: "Water bill (owner paid)" });
  await txn({ property: cedar.id, date: iso(monthsAgo(2, 8)), type: "expense", category: "turnover", amount: 780, description: "Paint + new flooring for turnover" });
  await txn({ property: maple.id, date: iso(monthsAgo(1, 15)), type: "expense", category: "insurance", amount: 410, description: "Landlord insurance premium" });

  const maintenance = (data: Record<string, unknown>) =>
    client.collection("maintenance_requests").create(data);
  await maintenance({ property: oak.id, person: dana.id, title: "Kitchen faucet dripping", description: "Slow drip from the kitchen faucet, getting worse.", priority: "medium", status: "new" });
  await maintenance({ property: maple.id, person: marcus.id, title: "Furnace making noise", description: "Rattling sound when the heat kicks on.", priority: "high", status: "in_progress" });
  await maintenance({ property: maple.id, person: marcus.id, title: "Gutter cleaning", description: "Requested seasonal gutter cleaning.", priority: "low", status: "completed", completed_at: iso(monthsAgo(2, 14)) });

  const document = (data: Record<string, unknown>) => client.collection("documents").create(data);
  await document({ name: "Maple St Lease 2025-2026", type: "lease", lease: mapleLease.id, property: maple.id, status: "signed", provider: "opensign", signed_at: iso(monthsAgo(7, 3)) });
  await document({ name: "Oakwood 2B Lease Renewal", type: "lease", lease: oakLease.id, property: oak.id, status: "signed", provider: "opensign", signed_at: iso(monthsAgo(5, 2)) });
  await document({ name: "Cedar Duplex Lease (Priya Sharma)", type: "lease", lease: cedarLease.id, property: cedar.id, status: "sent", provider: "opensign" });
  await document({ name: "Pet Addendum — Cedar Duplex", type: "addendum", lease: cedarLease.id, property: cedar.id, status: "draft", provider: "manual" });

  await client.collection("condition_reports").create({
    property: maple.id, lease: mapleLease.id, type: "move_in", status: "completed",
    notes: "Completed with tenant at move-in.", completed_at: iso(monthsAgo(7, 1)),
    items: [
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
    ],
  });
  await client.collection("condition_reports").create({
    property: cedar.id, lease: cedarLease.id, type: "move_in", status: "draft",
    items: [], notes: "To complete before Priya moves in.",
  });

  const rentChecking = await client.collection("bank_accounts").create({
    name: "Rent checking", institution: "First National", last4: "4821", kind: "bank",
    notes: "Main account — most rent lands here.",
  });
  await client.collection("bank_accounts").create({
    name: "Zelle (personal)", institution: "First National", last4: "4821", kind: "zelle",
    property: oak.id, notes: "Oakwood tenants pay by Zelle.",
  });
  await client.collection("bank_accounts").create({
    name: "Willow House account", institution: "Credit Union", last4: "2210", kind: "bank",
    property: willow.id, notes: "Room rent for the shared house.",
  });

  await client.collection("bank_imports").create({
    account: rentChecking.id, posted_date: iso(monthsAgo(0, 4)),
    description: "ZELLE FROM MARCUS WEBB SEPT RENT", amount: 1850, source: "zelle",
    status: "unmatched", fingerprint: "demo-1",
  });
  await client.collection("bank_imports").create({
    account: rentChecking.id, posted_date: iso(monthsAgo(0, 5)),
    description: "ACH DEPOSIT — CITY UTILITY REFUND", amount: 63.4, source: "bank",
    status: "unmatched", fingerprint: "demo-2",
  });

  await setSetting("business_name", "Demo Property Management");
  await setSetting("payment_methods", "ACH transfer, Zelle, Venmo, Check");
  await setSetting(
    "payment_instructions",
    "Zelle: payments@demo-pm.example — include your unit in the memo.\nChecks payable to Demo Property Management, mailed to PO Box 100, Columbus OH."
  );
  await setSetting("esign_provider", "opensign");
}
