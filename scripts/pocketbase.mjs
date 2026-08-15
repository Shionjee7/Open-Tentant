/**
 * Starts PocketBase for OpenTenant.
 *
 * Applies migrations, makes sure a superuser exists, and serves on PB_PORT.
 * Used by `npm run setup`, `npm run pb`, and the Docker entrypoint.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BINARY_PACKAGES = {
  "darwin-arm64": "pocketbase-server-darwin-arm64",
  "darwin-x64": "pocketbase-server-darwin-x64",
  "linux-arm64": "pocketbase-server-linux-arm64",
  "linux-x64": "pocketbase-server-linux-x64",
  "win32-arm64": "pocketbase-server-win32-arm64",
  "win32-x64": "pocketbase-server-win32-x64",
};

export function binaryPath() {
  const pkg = BINARY_PACKAGES[`${process.platform}-${process.arch}`];
  const name = process.platform === "win32" ? "pocketbase.exe" : "pocketbase";
  if (!pkg) {
    throw new Error(
      `No PocketBase build for ${process.platform}-${process.arch}. ` +
        `Download it from pocketbase.io and set PB_BINARY to its path.`
    );
  }
  if (process.env.PB_BINARY?.trim()) return process.env.PB_BINARY.trim();
  return require.resolve(`${pkg}/bin/${name}`);
}

export function paths() {
  const dataDir = process.env.DATA_DIR?.trim()
    ? path.resolve(process.env.DATA_DIR)
    : path.join(root, "data");
  return {
    dataDir,
    pbData: path.join(dataDir, "pb_data"),
    migrations: path.join(root, "pb", "pb_migrations"),
    // The browser app: plain HTML, CSS and JS that PocketBase serves itself.
    web: path.join(root, "web"),
  };
}

export const PB_PORT = process.env.PB_PORT || "8090";
export const PB_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@opentenant.local";
export const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || "opentenant-local-dev";

/** The account the browser app signs in with. */
export const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@opentenant.local";
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "opentenant-local-dev";

/** Applies migrations and ensures the superuser account the app signs in with. */
export function prepare() {
  const { pbData, migrations } = paths();
  fs.mkdirSync(pbData, { recursive: true });
  const bin = binaryPath();

  const migrateResult = spawnSync(
    bin,
    ["migrate", "up", "--dir", pbData, "--migrationsDir", migrations],
    { stdio: "inherit" }
  );
  if (migrateResult.status !== 0) {
    throw new Error("PocketBase migrations failed.");
  }

  spawnSync(bin, ["superuser", "upsert", PB_EMAIL, PB_PASSWORD, "--dir", pbData], {
    stdio: "ignore",
  });
}

/** Spawns `pocketbase serve`. Returns the child process. */
export function serve({ silent = false } = {}) {
  const { pbData, migrations, web } = paths();
  return spawn(
    binaryPath(),
    [
      "serve",
      "--dir", pbData,
      "--migrationsDir", migrations,
      "--publicDir", web,
      "--http", `127.0.0.1:${PB_PORT}`,
    ],
    { stdio: silent ? "ignore" : "inherit" }
  );
}

/**
 * Makes sure the landlord has an account to sign in with.
 *
 * The browser app talks to PocketBase directly, so it needs a real record —
 * and creating owners is closed to the public, or anyone who found a deployed
 * copy could make themselves one. So it happens here, once, on startup.
 * Returns true when it created the account, so the caller can print the
 * password exactly once.
 */
export async function ensureOwner() {
  const base = `http://127.0.0.1:${PB_PORT}`;
  const auth = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  }).then((r) => (r.ok ? r.json() : null));
  if (!auth?.token) return false;

  const existing = await fetch(`${base}/api/collections/owners/records?perPage=1`, {
    headers: { Authorization: auth.token },
  }).then((r) => (r.ok ? r.json() : null));
  if (!existing || (existing.totalItems ?? 0) > 0) return false;

  const created = await fetch(`${base}/api/collections/owners/records`, {
    method: "POST",
    headers: { Authorization: auth.token, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      passwordConfirm: OWNER_PASSWORD,
      emailVisibility: true,
      verified: true,
    }),
  });
  return created.ok;
}

export async function waitUntilHealthy(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PB_PORT}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

// Running this file directly just starts PocketBase on its own.
if (import.meta.url === `file://${process.argv[1]}`) {
  prepare();
  const child = serve();
  waitUntilHealthy().then(async (up) => {
    if (!up) return;
    const created = await ensureOwner();
    console.log(
      `\nOpenTenant is at http://127.0.0.1:${PB_PORT}` +
        (created
          ? `\nSign in with ${OWNER_EMAIL} / ${OWNER_PASSWORD} — change it in Settings.\n`
          : `\nSign in as ${OWNER_EMAIL}.\n`)
    );
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code) => process.exit(code ?? 0));
}
