import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'single_family',
  beds REAL NOT NULL DEFAULT 0,
  baths REAL NOT NULL DEFAULT 0,
  sqft INTEGER NOT NULL DEFAULT 0,
  rent REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'vacant',
  listed INTEGER NOT NULL DEFAULT 0,
  priority_listing INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  amenities TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rooms inside a property, for renting a house out by the room.
-- A property rented as a whole simply has no rooms.
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  rent REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'vacant',
  size_sqft INTEGER NOT NULL DEFAULT 0,
  private_bath INTEGER NOT NULL DEFAULT 0,
  furnished INTEGER NOT NULL DEFAULT 0,
  listed INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'lead',
  property_id INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  portal_token TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  required INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  property_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  monthly_income REAL NOT NULL DEFAULT 0,
  employer TEXT NOT NULL DEFAULT '',
  income_verified INTEGER NOT NULL DEFAULT 0,
  screening_status TEXT NOT NULL DEFAULT 'not_requested',
  screening_notes TEXT NOT NULL DEFAULT '',
  screening_link TEXT NOT NULL DEFAULT '',
  answers TEXT NOT NULL DEFAULT '[]',
  move_in_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rent REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  esign_provider TEXT NOT NULL DEFAULT '',
  esign_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lease_tenants (
  lease_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (lease_id, person_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lease_id INTEGER,
  person_id INTEGER,
  amount REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'rent',
  due_date TEXT NOT NULL,
  paid_date TEXT,
  method TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT NOT NULL DEFAULT '',
  reported_method TEXT NOT NULL DEFAULT '',
  reported_date TEXT NOT NULL DEFAULT '',
  reported_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  person_id INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER,
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'income',
  category TEXT NOT NULL DEFAULT 'rent',
  amount REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  payment_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lease',
  lease_id INTEGER,
  property_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  provider TEXT NOT NULL DEFAULT 'manual',
  external_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  signed_at TEXT
);

-- Where each property's rent lands. A property with no account here just
-- falls back to whatever the landlord's default is.
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  last4 TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'bank',
  property_id INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deposits imported from a statement, before and after they are matched to a
-- tenant's payment. Keeps a fingerprint so re-importing the same file is safe.
CREATE TABLE IF NOT EXISTS bank_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  posted_date TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'bank',
  status TEXT NOT NULL DEFAULT 'unmatched',
  payment_id INTEGER,
  person_id INTEGER,
  fingerprint TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_imports_fingerprint
  ON bank_imports(fingerprint) WHERE fingerprint <> '';

CREATE TABLE IF NOT EXISTS condition_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  lease_id INTEGER,
  type TEXT NOT NULL DEFAULT 'move_in',
  status TEXT NOT NULL DEFAULT 'draft',
  items TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
`;

/**
 * Columns added after the first release. Existing databases get them via
 * ALTER TABLE on startup, so upgrading is just `git pull` — no manual steps.
 */
const MIGRATIONS: [table: string, column: string, ddl: string][] = [
  ["properties", "rental_type", "TEXT NOT NULL DEFAULT 'whole'"],
  ["people", "unit_id", "INTEGER"],
  ["leases", "unit_id", "INTEGER"],
  ["applications", "unit_id", "INTEGER"],
  ["maintenance_requests", "unit_id", "INTEGER"],
];

function migrate(db: DatabaseSync) {
  for (const [table, column, ddl] of MIGRATIONS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __opentenant_db: DatabaseSync | undefined;
}

/**
 * Where the SQLite file lives. Defaults to ./data next to the app, which is
 * what you want locally. On a host, point DATA_DIR at your mounted volume
 * (e.g. /var/data on Render, /app/data in Docker) so the database survives
 * restarts and redeploys.
 */
function dataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data");
}

export function getDb(): DatabaseSync {
  if (globalThis.__opentenant_db) return globalThis.__opentenant_db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "opentenant.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  globalThis.__opentenant_db = db;
  return db;
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
