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
  };
}

export const PB_PORT = process.env.PB_PORT || "8090";
export const PB_EMAIL = process.env.PB_ADMIN_EMAIL || "admin@opentenant.local";
export const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || "opentenant-local-dev";

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
  const { pbData, migrations } = paths();
  return spawn(
    binaryPath(),
    [
      "serve",
      "--dir", pbData,
      "--migrationsDir", migrations,
      "--http", `127.0.0.1:${PB_PORT}`,
    ],
    { stdio: silent ? "ignore" : "inherit" }
  );
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
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code) => process.exit(code ?? 0));
}
