import { pb } from "./pb";
import type {
  Application,
  BankAccount,
  BankImport,
  ConditionReport,
  CustomQuestion,
  Doc,
  Id,
  Lease,
  MaintenanceRequest,
  Payment,
  Person,
  Property,
  Signature,
  Txn,
  Unit,
} from "./types";

/**
 * Reads for the whole app.
 *
 * PocketBase's record API has no SQL joins, so related names and totals are
 * resolved here in TypeScript. A landlord portfolio is small — tens of
 * properties, hundreds of payments — so fetching a collection and joining in
 * memory is both fast enough and far clearer than contorting filters.
 */

const ALL = { perPage: 500, sort: "-created" } as const;

async function fetchAll<T>(collection: string, options: Record<string, unknown> = {}): Promise<T[]> {
  const client = await pb();
  const records = await client
    .collection(collection)
    .getFullList({ ...ALL, ...options });
  return records as unknown as T[];
}

async function fetchOne<T>(collection: string, id: Id): Promise<T | undefined> {
  if (!id) return undefined;
  try {
    const client = await pb();
    return (await client.collection(collection).getOne(id)) as unknown as T;
  } catch {
    return undefined;
  }
}

function byId<T extends { id: Id }>(items: T[]): Map<Id, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function fullName(person: Person | undefined): string {
  return person ? `${person.first_name} ${person.last_name}`.trim() : "";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

// ---------- Properties ----------

export async function listProperties(): Promise<Property[]> {
  const [properties, units] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Unit>("units"),
  ]);
  return properties.map((property) => {
    const rooms = units.filter((u) => u.property === property.id);
    return {
      ...property,
      room_count: rooms.length,
      rooms_vacant: rooms.filter((r) => r.status === "vacant").length,
    };
  });
}

export async function listedProperties(): Promise<Property[]> {
  const properties = await listProperties();
  return properties
    .filter((p) => p.listed && p.rental_type !== "by_room")
    .sort((a, b) => Number(b.priority_listing) - Number(a.priority_listing));
}

export async function getProperty(id: Id): Promise<Property | undefined> {
  const property = await fetchOne<Property>("properties", id);
  if (!property) return undefined;
  const rooms = await listUnits(id);
  return {
    ...property,
    room_count: rooms.length,
    rooms_vacant: rooms.filter((r) => r.status === "vacant").length,
  };
}

// ---------- Rooms (units) ----------

async function decorateUnits(units: Unit[]): Promise<Unit[]> {
  const [properties, people] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Person>("people"),
  ]);
  const propertyMap = byId(properties);
  return units.map((unit) => {
    const property = propertyMap.get(unit.property);
    const tenants = people.filter((p) => p.unit === unit.id && p.stage === "tenant");
    return {
      ...unit,
      property_name: property?.name,
      property_address: property?.address,
      property_city: property?.city,
      property_state: property?.state,
      property_amenities: property?.amenities,
      tenant_names: tenants.map(fullName).join(", ") || undefined,
    };
  });
}

export async function listUnits(propertyId: Id): Promise<Unit[]> {
  const units = await fetchAll<Unit>("units", { sort: "created" });
  return decorateUnits(units.filter((u) => u.property === propertyId));
}

export async function listAllUnits(): Promise<Unit[]> {
  return decorateUnits(await fetchAll<Unit>("units", { sort: "created" }));
}

export async function getUnit(id: Id): Promise<Unit | undefined> {
  const unit = await fetchOne<Unit>("units", id);
  if (!unit) return undefined;
  return (await decorateUnits([unit]))[0];
}

/** Vacant, listed rooms in by-the-room properties — listed individually. */
export async function listedRooms(): Promise<Unit[]> {
  const [units, properties] = await Promise.all([listAllUnits(), fetchAll<Property>("properties")]);
  const listedByRoom = new Set(
    properties.filter((p) => p.listed && p.rental_type === "by_room").map((p) => p.id)
  );
  return units.filter((u) => listedByRoom.has(u.property) && u.listed && u.status === "vacant");
}

// ---------- People ----------

async function decoratePeople(people: Person[]): Promise<Person[]> {
  const [properties, units] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Unit>("units"),
  ]);
  const propertyMap = byId(properties);
  const unitMap = byId(units);
  return people.map((person) => ({
    ...person,
    property_name: person.property ? propertyMap.get(person.property)?.name : undefined,
    unit_name: person.unit ? unitMap.get(person.unit)?.name : undefined,
  }));
}

export async function listPeople(stage?: string): Promise<Person[]> {
  const people = await fetchAll<Person>("people");
  return decoratePeople(stage ? people.filter((p) => p.stage === stage) : people);
}

export async function getPerson(id: Id): Promise<Person | undefined> {
  const person = await fetchOne<Person>("people", id);
  if (!person) return undefined;
  return (await decoratePeople([person]))[0];
}

export async function getPersonByToken(token: string): Promise<Person | undefined> {
  if (!token) return undefined;
  const people = await fetchAll<Person>("people");
  const match = people.find((p) => p.portal_token === token);
  if (!match) return undefined;
  return (await decoratePeople([match]))[0];
}

export async function countPeopleByStage(): Promise<Record<string, number>> {
  const people = await fetchAll<Person>("people");
  const counts: Record<string, number> = { lead: 0, applicant: 0, tenant: 0, past: 0 };
  for (const person of people) counts[person.stage] = (counts[person.stage] ?? 0) + 1;
  return counts;
}

// ---------- Custom questions ----------

export async function listQuestions(includeArchived = false): Promise<CustomQuestion[]> {
  const questions = await fetchAll<CustomQuestion>("custom_questions", { sort: "created" });
  return includeArchived ? questions : questions.filter((q) => !q.archived);
}

// ---------- Applications ----------

async function decorateApplications(applications: Application[]): Promise<Application[]> {
  const [people, properties, units] = await Promise.all([
    fetchAll<Person>("people"),
    fetchAll<Property>("properties"),
    fetchAll<Unit>("units"),
  ]);
  const peopleMap = byId(people);
  const propertyMap = byId(properties);
  const unitMap = byId(units);
  return applications.map((application) => {
    const person = peopleMap.get(application.person);
    const property = application.property ? propertyMap.get(application.property) : undefined;
    const unit = application.unit ? unitMap.get(application.unit) : undefined;
    return {
      ...application,
      answers: Array.isArray(application.answers) ? application.answers : [],
      applicant_name: fullName(person),
      applicant_email: person?.email,
      property_name: property?.name,
      property_rent: property?.rent,
      unit_name: unit?.name,
      unit_rent: unit?.rent,
    };
  });
}

export async function listApplications(): Promise<Application[]> {
  return decorateApplications(await fetchAll<Application>("applications"));
}

export async function getApplication(id: Id): Promise<Application | undefined> {
  const application = await fetchOne<Application>("applications", id);
  if (!application) return undefined;
  return (await decorateApplications([application]))[0];
}

// ---------- Leases ----------

async function decorateLeases(leases: Lease[]): Promise<Lease[]> {
  const [properties, units, people] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Unit>("units"),
    fetchAll<Person>("people"),
  ]);
  const propertyMap = byId(properties);
  const unitMap = byId(units);
  const peopleMap = byId(people);
  return leases.map((lease) => ({
    ...lease,
    tenants: Array.isArray(lease.tenants) ? lease.tenants : [],
    property_name: propertyMap.get(lease.property)?.name,
    unit_name: lease.unit ? unitMap.get(lease.unit)?.name : undefined,
    tenant_names:
      (Array.isArray(lease.tenants) ? lease.tenants : [])
        .map((id) => fullName(peopleMap.get(id)))
        .filter(Boolean)
        .join(", ") || undefined,
  }));
}

export async function listLeases(): Promise<Lease[]> {
  return decorateLeases(await fetchAll<Lease>("leases"));
}

export async function getLease(id: Id): Promise<Lease | undefined> {
  const lease = await fetchOne<Lease>("leases", id);
  if (!lease) return undefined;
  return (await decorateLeases([lease]))[0];
}

export async function leaseTenantIds(leaseId: Id): Promise<Id[]> {
  const lease = await fetchOne<Lease>("leases", leaseId);
  return Array.isArray(lease?.tenants) ? lease.tenants : [];
}

export async function leasesExpiringWithin(days: number): Promise<Lease[]> {
  const leases = await listLeases();
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const limitIso = limit.toISOString().slice(0, 10);
  const now = today();
  return leases
    .filter((l) => l.status === "active" && l.end_date >= now && l.end_date <= limitIso)
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
}

// ---------- Payments ----------

async function decoratePayments(payments: Payment[]): Promise<Payment[]> {
  const [people, leases, properties] = await Promise.all([
    fetchAll<Person>("people"),
    fetchAll<Lease>("leases"),
    fetchAll<Property>("properties"),
  ]);
  const peopleMap = byId(people);
  const leaseMap = byId(leases);
  const propertyMap = byId(properties);
  return payments.map((payment) => {
    const lease = payment.lease ? leaseMap.get(payment.lease) : undefined;
    const property = lease ? propertyMap.get(lease.property) : undefined;
    return {
      ...payment,
      tenant_name: payment.person ? fullName(peopleMap.get(payment.person)) : undefined,
      property_name: property?.name,
    };
  });
}

export async function listPayments(): Promise<Payment[]> {
  return decoratePayments(await fetchAll<Payment>("payments", { sort: "-due_date" }));
}

export async function pastDuePayments(): Promise<Payment[]> {
  const payments = await listPayments();
  const now = today();
  return payments
    .filter((p) => p.status === "unpaid" && p.due_date < now)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export async function upcomingPayments(): Promise<Payment[]> {
  const payments = await listPayments();
  const now = today();
  return payments
    .filter((p) => p.status === "unpaid" && p.due_date >= now)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8);
}

export async function reportedPayments(): Promise<Payment[]> {
  const payments = await listPayments();
  return payments.filter((p) => p.status === "reported");
}

/** Every payment still awaiting money — matched against bank deposits. */
export async function openPayments(): Promise<Payment[]> {
  const payments = await listPayments();
  return payments.filter((p) => p.status === "unpaid" || p.status === "reported");
}

export async function paymentsForPerson(personId: Id): Promise<Payment[]> {
  const [payments, leases] = await Promise.all([listPayments(), fetchAll<Lease>("leases")]);
  const theirLeases = new Set(
    leases.filter((l) => (l.tenants ?? []).includes(personId)).map((l) => l.id)
  );
  return payments.filter((p) => p.person === personId || (p.lease && theirLeases.has(p.lease)));
}

export async function sumPaid(since: "month" | "year"): Promise<number> {
  const payments = await fetchAll<Payment>("payments");
  const from = since === "month" ? startOfMonth() : startOfYear();
  return payments
    .filter((p) => p.status === "paid" && p.paid_date && p.paid_date >= from)
    .reduce((total, p) => total + p.amount, 0);
}

export async function sumPastDue(): Promise<number> {
  const payments = await fetchAll<Payment>("payments");
  const now = today();
  return payments
    .filter((p) => p.status === "unpaid" && p.due_date < now)
    .reduce((total, p) => total + p.amount, 0);
}

export async function activeLeaseForPerson(personId: Id): Promise<Lease | undefined> {
  const leases = await listLeases();
  return leases
    .filter(
      (l) =>
        (l.tenants ?? []).includes(personId) &&
        ["active", "signed", "sent"].includes(l.status)
    )
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

// ---------- Maintenance ----------

async function decorateMaintenance(requests: MaintenanceRequest[]): Promise<MaintenanceRequest[]> {
  const [properties, people] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Person>("people"),
  ]);
  const propertyMap = byId(properties);
  const peopleMap = byId(people);
  return requests.map((request) => ({
    ...request,
    property_name: propertyMap.get(request.property)?.name,
    tenant_name: request.person ? fullName(peopleMap.get(request.person)) : undefined,
  }));
}

const MAINTENANCE_ORDER: Record<string, number> = { new: 0, in_progress: 1, completed: 2, cancelled: 3 };

export async function listMaintenance(): Promise<MaintenanceRequest[]> {
  const requests = await decorateMaintenance(await fetchAll<MaintenanceRequest>("maintenance_requests"));
  return requests.sort(
    (a, b) => (MAINTENANCE_ORDER[a.status] ?? 9) - (MAINTENANCE_ORDER[b.status] ?? 9)
  );
}

export async function maintenanceForPerson(personId: Id): Promise<MaintenanceRequest[]> {
  const requests = await listMaintenance();
  return requests.filter((r) => r.person === personId);
}

export async function countOpenMaintenance(): Promise<number> {
  const requests = await fetchAll<MaintenanceRequest>("maintenance_requests");
  return requests.filter((r) => r.status === "new" || r.status === "in_progress").length;
}

// ---------- Transactions / accounting ----------

export async function listTransactions(): Promise<Txn[]> {
  const [transactions, properties] = await Promise.all([
    fetchAll<Txn>("transactions", { sort: "-date" }),
    fetchAll<Property>("properties"),
  ]);
  const propertyMap = byId(properties);
  return transactions.map((t) => ({
    ...t,
    property_name: t.property ? propertyMap.get(t.property)?.name : undefined,
  }));
}

export async function monthlyTotals(months: number) {
  const transactions = await fetchAll<Txn>("transactions");
  const buckets = new Map<string, { month: string; income: number; expenses: number }>();

  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { month: key, income: 0, expenses: 0 });
  }

  for (const transaction of transactions) {
    const key = (transaction.date ?? "").slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (transaction.type === "income") bucket.income += transaction.amount;
    else bucket.expenses += transaction.amount;
  }
  return [...buckets.values()];
}

export async function totalsByType(): Promise<{ income: number; expenses: number }> {
  const transactions = await fetchAll<Txn>("transactions");
  return transactions.reduce(
    (totals, t) => {
      if (t.type === "income") totals.income += t.amount;
      else totals.expenses += t.amount;
      return totals;
    },
    { income: 0, expenses: 0 }
  );
}

export async function expensesByCategory(): Promise<{ category: string; total: number }[]> {
  const transactions = await fetchAll<Txn>("transactions");
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// ---------- Documents ----------

export async function listDocuments(): Promise<Doc[]> {
  const [documents, properties] = await Promise.all([
    fetchAll<Doc>("documents"),
    fetchAll<Property>("properties"),
  ]);
  const propertyMap = byId(properties);
  return documents.map((d) => ({
    ...d,
    property_name: d.property ? propertyMap.get(d.property)?.name : undefined,
  }));
}

// ---------- Signatures ----------

export async function listSignatures(leaseId: Id): Promise<Signature[]> {
  const all = await fetchAll<Signature>("signatures", { sort: "created" });
  return all.filter((s) => s.lease === leaseId);
}

/** All signature rows, for counting outstanding requests across leases. */
export async function listAllSignatures(): Promise<Signature[]> {
  return fetchAll<Signature>("signatures", { sort: "created" });
}

export async function getSignatureByToken(token: string): Promise<Signature | undefined> {
  if (!token) return undefined;
  const all = await fetchAll<Signature>("signatures");
  return all.find((s) => s.token === token);
}

// ---------- Condition reports ----------

async function decorateReports(reports: ConditionReport[]): Promise<ConditionReport[]> {
  const properties = await fetchAll<Property>("properties");
  const propertyMap = byId(properties);
  return reports.map((report) => ({
    ...report,
    items: Array.isArray(report.items) ? report.items : [],
    property_name: propertyMap.get(report.property)?.name,
  }));
}

export async function listConditionReports(): Promise<ConditionReport[]> {
  return decorateReports(await fetchAll<ConditionReport>("condition_reports"));
}

export async function getConditionReport(id: Id): Promise<ConditionReport | undefined> {
  const report = await fetchOne<ConditionReport>("condition_reports", id);
  if (!report) return undefined;
  return (await decorateReports([report]))[0];
}

// ---------- Bank accounts & imports ----------

export async function listBankAccounts(): Promise<BankAccount[]> {
  const [accounts, properties] = await Promise.all([
    fetchAll<BankAccount>("bank_accounts", { sort: "created" }),
    fetchAll<Property>("properties"),
  ]);
  const propertyMap = byId(properties);
  return accounts.map((a) => ({
    ...a,
    property_name: a.property ? propertyMap.get(a.property)?.name : undefined,
  }));
}

export async function listBankImports(status?: string): Promise<BankImport[]> {
  const [imports, accounts, people, payments] = await Promise.all([
    fetchAll<BankImport>("bank_imports", { sort: "-posted_date" }),
    fetchAll<BankAccount>("bank_accounts"),
    fetchAll<Person>("people"),
    fetchAll<Payment>("payments"),
  ]);
  const accountMap = byId(accounts);
  const peopleMap = byId(people);
  const paymentMap = byId(payments);
  const decorated = imports.map((deposit) => {
    const payment = deposit.payment ? paymentMap.get(deposit.payment) : undefined;
    return {
      ...deposit,
      account_name: deposit.account ? accountMap.get(deposit.account)?.name : undefined,
      matched_tenant: deposit.person ? fullName(peopleMap.get(deposit.person)) : undefined,
      matched_payment_date: payment?.paid_date || payment?.due_date || undefined,
    };
  });
  return status ? decorated.filter((d) => d.status === status) : decorated;
}

/**
 * What the books look like now, and where they head if nothing changes.
 *
 * The projection is deliberately simple and states its own assumption: every
 * currently-active lease keeps paying its rent, and the last twelve months of
 * expenses repeat. It is a planning aid, not a forecast.
 */
export type Outlook = ReturnType<typeof buildOutlook>;

/**
 * The money picture for one set of books.
 *
 * Used for the whole portfolio and for a single property, so the two can never
 * disagree — a house's numbers are the same arithmetic on a smaller pile.
 */
function buildOutlook(transactions: Txn[], leases: Lease[], payments: Payment[]) {
  const sum = (rows: Txn[]) => rows.reduce((total, t) => total + t.amount, 0);
  const of = (type: "income" | "expense", from = "") =>
    transactions.filter((t) => t.type === type && (!from || t.date >= from));

  const monthStart = startOfMonth();
  const yearStart = `${new Date().getFullYear()}-01-01`;

  // Twelve-month trailing expense rate, so a projection isn't rent-only. A
  // roof replacement last March still counts against next year's outlook.
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const trailingFrom = yearAgo.toISOString().slice(0, 10);
  const monthlyExpenseRate = sum(of("expense", trailingFrom)) / 12;

  const income = sum(of("income"));
  const expenses = sum(of("expense"));
  const onHand = income - expenses;

  const activeLeases = leases.filter((l) => l.status === "active");
  const monthlyRent = activeLeases.reduce((total, l) => total + l.rent, 0);
  const monthlyNet = monthlyRent - monthlyExpenseRate;

  const incomeThisMonth = sum(of("income", monthStart));
  const expensesThisMonth = sum(of("expense", monthStart));
  const incomeThisYear = sum(of("income", yearStart));
  const expensesThisYear = sum(of("expense", yearStart));

  return {
    income,
    expenses,
    onHand,
    incomeThisMonth,
    expensesThisMonth,
    netThisMonth: incomeThisMonth - expensesThisMonth,
    incomeThisYear,
    expensesThisYear,
    netThisYear: incomeThisYear - expensesThisYear,
    monthlyRent,
    monthlyExpenseRate,
    monthlyNet,
    /** What a full year at today's leases and expense rate looks like. */
    yearlyRent: monthlyRent * 12,
    yearlyExpenses: monthlyExpenseRate * 12,
    yearlyNet: monthlyNet * 12,
    activeLeaseCount: activeLeases.length,
    outstanding: payments.filter((p) => p.status !== "paid").reduce((t, p) => t + p.amount, 0),
    projections: [1, 2, 3, 4, 5].map((years) => ({
      years,
      rent: monthlyRent * 12 * years,
      expenses: monthlyExpenseRate * 12 * years,
      net: monthlyNet * 12 * years,
      balance: onHand + monthlyNet * 12 * years,
    })),
  };
}

export async function financialOutlook() {
  const [transactions, leases, payments] = await Promise.all([
    fetchAll<Txn>("transactions"),
    listLeases(),
    fetchAll<Payment>("payments"),
  ]);
  return buildOutlook(transactions, leases, payments);
}

export type PropertyOutlook = {
  property: Property;
  outlook: Outlook;
  /** Rooms, for a by-the-room house. Zero when the whole place is let. */
  rooms: number;
  roomsOccupied: number;
  tenantCount: number;
};

/**
 * The same picture, one house at a time.
 *
 * A transaction belongs to a property or to nothing; leases and payments reach
 * a property through their lease. Anything left unassigned is reported
 * separately rather than spread across houses on a guess — see
 * `portfolioSummary`.
 */
export async function propertyOutlooks(): Promise<PropertyOutlook[]> {
  const [properties, units, transactions, leases, payments, people] = await Promise.all([
    listProperties(),
    fetchAll<Unit>("units"),
    fetchAll<Txn>("transactions"),
    listLeases(),
    fetchAll<Payment>("payments"),
    fetchAll<Person>("people"),
  ]);

  const leaseProperty = new Map(leases.map((l) => [l.id, l.property]));

  return properties.map((property) => {
    const ourLeases = leases.filter((l) => l.property === property.id);
    const ourRooms = units.filter((u) => u.property === property.id);
    return {
      property,
      outlook: buildOutlook(
        transactions.filter((t) => t.property === property.id),
        ourLeases,
        payments.filter((p) => p.lease && leaseProperty.get(p.lease) === property.id)
      ),
      rooms: property.rental_type === "by_room" ? ourRooms.length : 0,
      roomsOccupied: ourRooms.filter((u) => u.status === "occupied").length,
      tenantCount: people.filter((p) => p.stage === "tenant" && p.property === property.id).length,
    };
  });
}

/**
 * Portfolio totals, plus the counts a landlord actually quotes — how many
 * houses, how many rooms, how many are filled.
 */
export async function portfolioSummary() {
  const [outlooks, portfolio, transactions] = await Promise.all([
    propertyOutlooks(),
    financialOutlook(),
    fetchAll<Txn>("transactions"),
  ]);

  // Expenses booked portfolio-wide — insurance across every house, software,
  // an accountant. Real money, but not attributable to one address.
  const unassigned = transactions
    .filter((t) => t.type === "expense" && !t.property)
    .reduce((total, t) => total + t.amount, 0);

  return {
    portfolio,
    properties: outlooks,
    houses: outlooks.length,
    housesOccupied: outlooks.filter((o) => o.property.status === "occupied").length,
    byRoomHouses: outlooks.filter((o) => o.property.rental_type === "by_room").length,
    rooms: outlooks.reduce((total, o) => total + o.rooms, 0),
    roomsOccupied: outlooks.reduce((total, o) => total + o.roomsOccupied, 0),
    tenants: outlooks.reduce((total, o) => total + o.tenantCount, 0),
    unassignedExpenses: unassigned,
  };
}

export type AccountBalance = {
  account: BankAccount;
  /** Deposits imported since the opening balance date. */
  depositsIn: number;
  /** Expenses booked to this account's property since that date. */
  expensesOut: number;
  balance: number;
  /** False when no opening balance is set, so the figure is only a movement. */
  known: boolean;
  lastImport: string;
};

/**
 * What's in each account.
 *
 * A statement import only covers what was uploaded, so it can't know a
 * balance on its own. Give the app a starting point and it carries it forward:
 * opening balance, plus everything imported since, minus what the linked
 * property spent. It's an estimate that reconciles against a real statement.
 */
export async function accountBalances(): Promise<AccountBalance[]> {
  const [accounts, deposits, transactions, properties] = await Promise.all([
    fetchAll<BankAccount>("bank_accounts"),
    fetchAll<BankImport>("bank_imports"),
    fetchAll<Txn>("transactions"),
    listProperties(),
  ]);
  const propertyMap = byId(properties);

  return accounts.map((account) => {
    const from = account.balance_date || "";
    const ours = deposits.filter((d) => d.account === account.id && (!from || d.posted_date >= from));
    const depositsIn = ours.reduce((total, d) => total + Math.abs(d.amount), 0);
    const expensesOut = account.property
      ? transactions
          .filter((t) => t.type === "expense" && t.property === account.property && (!from || t.date >= from))
          .reduce((total, t) => total + t.amount, 0)
      : 0;
    const opening = account.opening_balance || 0;

    return {
      account: { ...account, property_name: propertyMap.get(account.property)?.name },
      depositsIn,
      expensesOut,
      balance: opening + depositsIn - expensesOut,
      known: Boolean(account.balance_date),
      lastImport: ours.map((d) => d.posted_date).sort().at(-1) ?? "",
    };
  });
}

// ---------- Dashboard ----------

export async function dashboardStats() {
  const [properties, stages, leases, collectedMonth, collectedYear, pastDue, openMaintenance] =
    await Promise.all([
      listProperties(),
      countPeopleByStage(),
      fetchAll<Lease>("leases"),
      sumPaid("month"),
      sumPaid("year"),
      sumPastDue(),
      countOpenMaintenance(),
    ]);

  const occupied = properties.filter((p) => p.status === "occupied").length;
  return {
    properties: properties.length,
    occupied,
    vacant: properties.length - occupied,
    occupancyRate: properties.length ? Math.round((occupied / properties.length) * 100) : 0,
    tenants: stages.tenant ?? 0,
    leads: stages.lead ?? 0,
    applicants: stages.applicant ?? 0,
    activeLeases: leases.filter((l) => l.status === "active").length,
    collectedThisMonth: collectedMonth,
    collectedThisYear: collectedYear,
    pastDue,
    openMaintenance,
  };
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const [properties, people] = await Promise.all([
    fetchAll<Property>("properties"),
    fetchAll<Person>("people"),
  ]);
  return properties.length === 0 && people.length === 0;
}

// ---------- Settings ----------

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const client = await pb();
  try {
    const record = await client
      .collection("settings")
      .getFirstListItem(`key="${key.replace(/"/g, '')}"`);
    return (record as unknown as { value: string }).value || fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const client = await pb();
  try {
    const existing = await client
      .collection("settings")
      .getFirstListItem(`key="${key.replace(/"/g, '')}"`);
    await client.collection("settings").update(existing.id, { value });
  } catch {
    await client.collection("settings").create({ key, value });
  }
}
