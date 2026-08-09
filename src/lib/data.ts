import { getDb } from "./db";
import type {
  Application,
  ConditionReport,
  CustomQuestion,
  Doc,
  Lease,
  MaintenanceRequest,
  Payment,
  Person,
  Property,
  Txn,
  Unit,
  BankAccount,
  BankImport,
} from "./types";

/**
 * node:sqlite hands back rows with a null prototype, which React refuses to
 * serialize when a Server Component passes data to a Client Component. Copying
 * each row into a plain object here means every query result is safe to pass
 * anywhere, rather than blowing up only on the pages that cross that boundary.
 */
function plain<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T;
}

function all<T>(sql: string, ...params: (string | number)[]): T[] {
  return (getDb().prepare(sql).all(...params) as unknown[]).map((row) => plain<T>(row));
}

function one<T>(sql: string, ...params: (string | number)[]): T | undefined {
  const row = getDb().prepare(sql).get(...params);
  return row === undefined ? undefined : plain<T>(row);
}

// ---------- Properties ----------

const PROPERTY_SELECT = `
  SELECT p.*,
         (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS room_count,
         (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id AND u.status = 'vacant') AS rooms_vacant
  FROM properties p`;

export function listProperties(): Property[] {
  return all<Property>(`${PROPERTY_SELECT} ORDER BY p.created_at DESC`);
}

export function listedProperties(): Property[] {
  return all<Property>(
    `${PROPERTY_SELECT}
     WHERE p.listed = 1 AND p.rental_type = 'whole'
     ORDER BY p.priority_listing DESC, p.created_at DESC`
  );
}

export function getProperty(id: number): Property | undefined {
  return one<Property>(`${PROPERTY_SELECT} WHERE p.id = ?`, id);
}

// ---------- Rooms (units) ----------

const UNIT_SELECT = `
  SELECT u.*,
         p.name AS property_name,
         p.address AS property_address,
         p.city AS property_city,
         p.state AS property_state,
         p.amenities AS property_amenities,
         (SELECT group_concat(pe.first_name || ' ' || pe.last_name, ', ')
          FROM people pe WHERE pe.unit_id = u.id AND pe.stage = 'tenant') AS tenant_names
  FROM units u JOIN properties p ON p.id = u.property_id`;

export function listUnits(propertyId: number): Unit[] {
  return all<Unit>(`${UNIT_SELECT} WHERE u.property_id = ? ORDER BY u.id`, propertyId);
}

export function getUnit(id: number): Unit | undefined {
  return one<Unit>(`${UNIT_SELECT} WHERE u.id = ?`, id);
}

export function listAllUnits(): Unit[] {
  return all<Unit>(`${UNIT_SELECT} ORDER BY p.name, u.id`);
}

/** Vacant, listed rooms in by-the-room properties — shown individually on the listings page. */
export function listedRooms(): Unit[] {
  return all<Unit>(
    `${UNIT_SELECT}
     WHERE p.listed = 1 AND p.rental_type = 'by_room' AND u.listed = 1 AND u.status = 'vacant'
     ORDER BY p.priority_listing DESC, p.name, u.id`
  );
}

// ---------- People ----------

export function listPeople(stage?: string): Person[] {
  const base = `SELECT p.*, pr.name AS property_name, u.name AS unit_name
     FROM people p
     LEFT JOIN properties pr ON pr.id = p.property_id
     LEFT JOIN units u ON u.id = p.unit_id`;
  if (stage) {
    return all<Person>(`${base} WHERE p.stage = ? ORDER BY p.created_at DESC`, stage);
  }
  return all<Person>(`${base} ORDER BY p.created_at DESC`);
}

export function getPerson(id: number): Person | undefined {
  return one<Person>(
    `SELECT p.*, pr.name AS property_name, u.name AS unit_name
     FROM people p
     LEFT JOIN properties pr ON pr.id = p.property_id
     LEFT JOIN units u ON u.id = p.unit_id
     WHERE p.id = ?`,
    id
  );
}

export function getPersonByToken(token: string): Person | undefined {
  if (!token) return undefined;
  return one<Person>(
    `SELECT p.*, pr.name AS property_name, u.name AS unit_name
     FROM people p
     LEFT JOIN properties pr ON pr.id = p.property_id
     LEFT JOIN units u ON u.id = p.unit_id
     WHERE p.portal_token = ?`,
    token
  );
}

export function countPeopleByStage(): Record<string, number> {
  const rows = all<{ stage: string; n: number }>(
    "SELECT stage, COUNT(*) AS n FROM people GROUP BY stage"
  );
  const out: Record<string, number> = { lead: 0, applicant: 0, tenant: 0, past: 0 };
  for (const r of rows) out[r.stage] = r.n;
  return out;
}

// ---------- Custom questions ----------

export function listQuestions(includeArchived = false): CustomQuestion[] {
  return includeArchived
    ? all<CustomQuestion>("SELECT * FROM custom_questions ORDER BY id")
    : all<CustomQuestion>("SELECT * FROM custom_questions WHERE archived = 0 ORDER BY id");
}

// ---------- Applications ----------

export function listApplications(): Application[] {
  return all<Application>(
    `SELECT a.*,
            p.first_name || ' ' || p.last_name AS applicant_name,
            p.email AS applicant_email,
            pr.name AS property_name,
            pr.rent AS property_rent,
            u.name AS unit_name,
            u.rent AS unit_rent
     FROM applications a
     JOIN people p ON p.id = a.person_id
     LEFT JOIN properties pr ON pr.id = a.property_id
     LEFT JOIN units u ON u.id = a.unit_id
     ORDER BY a.created_at DESC`
  );
}

export function getApplication(id: number): Application | undefined {
  return one<Application>(
    `SELECT a.*,
            p.first_name || ' ' || p.last_name AS applicant_name,
            p.email AS applicant_email,
            pr.name AS property_name,
            pr.rent AS property_rent,
            u.name AS unit_name,
            u.rent AS unit_rent
     FROM applications a
     JOIN people p ON p.id = a.person_id
     LEFT JOIN properties pr ON pr.id = a.property_id
     LEFT JOIN units u ON u.id = a.unit_id
     WHERE a.id = ?`,
    id
  );
}

// ---------- Leases ----------

export function listLeases(): Lease[] {
  return all<Lease>(
    `SELECT l.*, pr.name AS property_name, u.name AS unit_name,
            (SELECT group_concat(pe.first_name || ' ' || pe.last_name, ', ')
             FROM lease_tenants lt JOIN people pe ON pe.id = lt.person_id
             WHERE lt.lease_id = l.id) AS tenant_names
     FROM leases l
     JOIN properties pr ON pr.id = l.property_id
     LEFT JOIN units u ON u.id = l.unit_id
     ORDER BY l.created_at DESC`
  );
}

export function getLease(id: number): Lease | undefined {
  return one<Lease>(
    `SELECT l.*, pr.name AS property_name, u.name AS unit_name,
            (SELECT group_concat(pe.first_name || ' ' || pe.last_name, ', ')
             FROM lease_tenants lt JOIN people pe ON pe.id = lt.person_id
             WHERE lt.lease_id = l.id) AS tenant_names
     FROM leases l
     JOIN properties pr ON pr.id = l.property_id
     LEFT JOIN units u ON u.id = l.unit_id
     WHERE l.id = ?`,
    id
  );
}

export function leaseTenantIds(leaseId: number): number[] {
  return all<{ person_id: number }>(
    "SELECT person_id FROM lease_tenants WHERE lease_id = ?",
    leaseId
  ).map((r) => r.person_id);
}

export function leasesExpiringWithin(days: number): Lease[] {
  return all<Lease>(
    `SELECT l.*, pr.name AS property_name, u.name AS unit_name,
            (SELECT group_concat(pe.first_name || ' ' || pe.last_name, ', ')
             FROM lease_tenants lt JOIN people pe ON pe.id = lt.person_id
             WHERE lt.lease_id = l.id) AS tenant_names
     FROM leases l JOIN properties pr ON pr.id = l.property_id
     LEFT JOIN units u ON u.id = l.unit_id
     WHERE l.status = 'active'
       AND date(l.end_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
     ORDER BY l.end_date`,
    days
  );
}

// ---------- Payments ----------

const PAYMENT_SELECT = `
  SELECT pay.*,
         pe.first_name || ' ' || pe.last_name AS tenant_name,
         pr.name AS property_name
  FROM payments pay
  LEFT JOIN people pe ON pe.id = pay.person_id
  LEFT JOIN leases l ON l.id = pay.lease_id
  LEFT JOIN properties pr ON pr.id = l.property_id`;

export function listPayments(): Payment[] {
  return all<Payment>(`${PAYMENT_SELECT} ORDER BY pay.due_date DESC`);
}

export function pastDuePayments(): Payment[] {
  return all<Payment>(
    `${PAYMENT_SELECT}
     WHERE pay.status = 'unpaid' AND date(pay.due_date) < date('now')
     ORDER BY pay.due_date`
  );
}

export function upcomingPayments(): Payment[] {
  return all<Payment>(
    `${PAYMENT_SELECT}
     WHERE pay.status = 'unpaid' AND date(pay.due_date) >= date('now')
     ORDER BY pay.due_date LIMIT 8`
  );
}

export function reportedPayments(): Payment[] {
  return all<Payment>(
    `${PAYMENT_SELECT} WHERE pay.status = 'reported' ORDER BY pay.reported_date DESC`
  );
}

export function paymentsForPerson(personId: number): Payment[] {
  return all<Payment>(
    `${PAYMENT_SELECT}
     WHERE pay.person_id = ?
        OR pay.lease_id IN (SELECT lease_id FROM lease_tenants WHERE person_id = ?)
     ORDER BY pay.due_date DESC`,
    personId,
    personId
  );
}

export function activeLeaseForPerson(personId: number): Lease | undefined {
  return one<Lease>(
    `SELECT l.*, pr.name AS property_name, u.name AS unit_name,
            (SELECT group_concat(pe.first_name || ' ' || pe.last_name, ', ')
             FROM lease_tenants lt JOIN people pe ON pe.id = lt.person_id
             WHERE lt.lease_id = l.id) AS tenant_names
     FROM leases l
     JOIN properties pr ON pr.id = l.property_id
     LEFT JOIN units u ON u.id = l.unit_id
     JOIN lease_tenants lt2 ON lt2.lease_id = l.id AND lt2.person_id = ?
     WHERE l.status IN ('active', 'signed', 'sent')
     ORDER BY l.start_date DESC LIMIT 1`,
    personId
  );
}

export function maintenanceForPerson(personId: number): MaintenanceRequest[] {
  return all<MaintenanceRequest>(
    `SELECT m.*, pr.name AS property_name,
            pe.first_name || ' ' || pe.last_name AS tenant_name
     FROM maintenance_requests m
     JOIN properties pr ON pr.id = m.property_id
     LEFT JOIN people pe ON pe.id = m.person_id
     WHERE m.person_id = ?
     ORDER BY m.created_at DESC`,
    personId
  );
}

export function sumPaid(sinceExpr: string): number {
  const row = one<{ total: number | null }>(
    `SELECT SUM(amount) AS total FROM payments
     WHERE status = 'paid' AND date(paid_date) >= date('now', ?)`,
    sinceExpr
  );
  return row?.total ?? 0;
}

export function sumPastDue(): number {
  const row = one<{ total: number | null }>(
    `SELECT SUM(amount) AS total FROM payments
     WHERE status = 'unpaid' AND date(due_date) < date('now')`
  );
  return row?.total ?? 0;
}

/** Every payment still awaiting money — the pool we match bank deposits against. */
export function openPayments(): Payment[] {
  return all<Payment>(
    `${PAYMENT_SELECT} WHERE pay.status IN ('unpaid','reported') ORDER BY pay.due_date DESC`
  );
}

// ---------- Bank accounts & statement imports ----------

export function listBankAccounts(): BankAccount[] {
  return all<BankAccount>(
    `SELECT b.*, pr.name AS property_name
     FROM bank_accounts b LEFT JOIN properties pr ON pr.id = b.property_id
     ORDER BY b.created_at`
  );
}

export function listBankImports(status?: string): BankImport[] {
  const base = `
    SELECT bi.*, ba.name AS account_name,
           pe.first_name || ' ' || pe.last_name AS matched_tenant
    FROM bank_imports bi
    LEFT JOIN bank_accounts ba ON ba.id = bi.account_id
    LEFT JOIN people pe ON pe.id = bi.person_id`;
  return status
    ? all<BankImport>(`${base} WHERE bi.status = ? ORDER BY bi.posted_date DESC`, status)
    : all<BankImport>(`${base} ORDER BY bi.posted_date DESC`);
}

// ---------- Maintenance ----------

export function listMaintenance(): MaintenanceRequest[] {
  return all<MaintenanceRequest>(
    `SELECT m.*, pr.name AS property_name,
            pe.first_name || ' ' || pe.last_name AS tenant_name
     FROM maintenance_requests m
     JOIN properties pr ON pr.id = m.property_id
     LEFT JOIN people pe ON pe.id = m.person_id
     ORDER BY CASE m.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
              m.created_at DESC`
  );
}

export function countOpenMaintenance(): number {
  const row = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM maintenance_requests WHERE status IN ('new','in_progress')"
  );
  return row?.n ?? 0;
}

// ---------- Transactions / accounting ----------

export function listTransactions(): Txn[] {
  return all<Txn>(
    `SELECT t.*, pr.name AS property_name
     FROM transactions t LEFT JOIN properties pr ON pr.id = t.property_id
     ORDER BY t.date DESC, t.id DESC`
  );
}

export function monthlyTotals(months: number): {
  month: string;
  income: number;
  expenses: number;
}[] {
  return all<{ month: string; income: number; expenses: number }>(
    `SELECT strftime('%Y-%m', date) AS month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions
     WHERE date(date) >= date('now', 'start of month', '-' || ? || ' months')
     GROUP BY month ORDER BY month`,
    months - 1
  );
}

export function totalsByType(): { income: number; expenses: number } {
  const row = one<{ income: number | null; expenses: number | null }>(
    `SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
     FROM transactions`
  );
  return { income: row?.income ?? 0, expenses: row?.expenses ?? 0 };
}

export function expensesByCategory(): { category: string; total: number }[] {
  return all<{ category: string; total: number }>(
    `SELECT category, SUM(amount) AS total FROM transactions
     WHERE type = 'expense' GROUP BY category ORDER BY total DESC`
  );
}

// ---------- Documents ----------

export function listDocuments(): Doc[] {
  return all<Doc>(
    `SELECT d.*, pr.name AS property_name
     FROM documents d LEFT JOIN properties pr ON pr.id = d.property_id
     ORDER BY d.created_at DESC`
  );
}

// ---------- Condition reports ----------

export function listConditionReports(): ConditionReport[] {
  return all<ConditionReport>(
    `SELECT c.*, pr.name AS property_name
     FROM condition_reports c JOIN properties pr ON pr.id = c.property_id
     ORDER BY c.created_at DESC`
  );
}

export function getConditionReport(id: number): ConditionReport | undefined {
  return one<ConditionReport>(
    `SELECT c.*, pr.name AS property_name
     FROM condition_reports c JOIN properties pr ON pr.id = c.property_id
     WHERE c.id = ?`,
    id
  );
}

// ---------- Dashboard ----------

export function dashboardStats() {
  const props = listProperties();
  const occupied = props.filter((p) => p.status === "occupied").length;
  const stages = countPeopleByStage();
  const activeLeases = all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM leases WHERE status = 'active'"
  )[0]?.n ?? 0;
  return {
    properties: props.length,
    occupied,
    vacant: props.length - occupied,
    occupancyRate: props.length ? Math.round((occupied / props.length) * 100) : 0,
    tenants: stages.tenant,
    leads: stages.lead,
    applicants: stages.applicant,
    activeLeases,
    collectedThisMonth: sumPaid("start of month"),
    collectedThisYear: sumPaid("start of year"),
    pastDue: sumPastDue(),
    openMaintenance: countOpenMaintenance(),
  };
}

export function isDatabaseEmpty(): boolean {
  const row = one<{ n: number }>("SELECT COUNT(*) AS n FROM properties");
  const people = one<{ n: number }>("SELECT COUNT(*) AS n FROM people");
  return (row?.n ?? 0) === 0 && (people?.n ?? 0) === 0;
}
