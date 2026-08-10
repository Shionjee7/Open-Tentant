#!/usr/bin/env node
/**
 * One command to go from a fresh clone to a running app:
 *
 *   npm run setup
 *
 * Checks the Node version, installs dependencies if needed, builds, and starts
 * the server. Safe to re-run — steps already done are skipped.
 */

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NODE = [22, 13, 0];

const bold = (s) => `\u001b[1m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

function step(message) {
  console.log(`\n${bold("→")} ${message}`);
}

function run(command) {
  execSync(command, { cwd: root, stdio: "inherit" });
}

// --- 1. Node version -------------------------------------------------------
const current = process.versions.node.split(".").map(Number);
const tooOld =
  current[0] < MIN_NODE[0] ||
  (current[0] === MIN_NODE[0] && current[1] < MIN_NODE[1]);

if (tooOld) {
  console.error(`
${red("Node.js is too old.")}

OpenTenant needs Node ${MIN_NODE[0]}.${MIN_NODE[1]} or newer (it uses Node's built-in
SQLite, so there is nothing else to install). You have ${process.versions.node}.

Install the current LTS from https://nodejs.org — or with nvm:

    nvm install 22 && nvm use 22

Then run ${bold("npm run setup")} again.
`);
  process.exit(1);
}
console.log(`${green("✓")} Node ${process.versions.node}`);

// --- 2. Dependencies -------------------------------------------------------
const nodeModules = path.join(root, "node_modules", "next");
if (!fs.existsSync(nodeModules)) {
  step("Installing dependencies (about a minute the first time)…");
  run(fs.existsSync(path.join(root, "package-lock.json")) ? "npm ci" : "npm install");
} else {
  console.log(`${green("✓")} Dependencies already installed`);
}

// --- 3. Build --------------------------------------------------------------
const buildId = path.join(root, ".next", "BUILD_ID");
if (!fs.existsSync(buildId) || process.argv.includes("--rebuild")) {
  step("Building…");
  run("npm run build");
} else {
  console.log(`${green("✓")} Build already present ${dim("(npm run setup --rebuild to force)")}`);
}

// --- 4. Database (PocketBase) ----------------------------------------------
const { prepare, serve, waitUntilHealthy, paths, PB_PORT } = await import("./pocketbase.mjs");
const { pbData } = paths();
const isNew = !fs.existsSync(path.join(pbData, "data.db"));

step("Preparing the database…");
prepare();
const database = serve({ silent: true });
if (!(await waitUntilHealthy())) {
  console.error(`\n${red("PocketBase didn't start.")} Run ${bold("npm run pb")} to see why.`);
  database.kill();
  process.exit(1);
}
console.log(`${green("✓")} Database ready`);

// --- 5. Start the app ------------------------------------------------------
const port = process.env.PORT || "3000";
const gated = Boolean(process.env.ADMIN_PASSWORD?.trim());

console.log(`
${green(bold("OpenTenant is running."))}

  Open        ${bold(`http://localhost:${port}`)}
  Data        ${pbData}${isNew ? dim("  (new — click “Load demo data” to explore)") : ""}
  Admin UI    ${dim(`http://127.0.0.1:${PB_PORT}/_/  (database console)`)}
  Login gate  ${gated ? "on (ADMIN_PASSWORD is set)" : dim("off — set ADMIN_PASSWORD before putting this on the internet")}

  ${dim("Press Ctrl+C to stop.")}
`);

const server = spawn("npm", ["start"], { cwd: root, stdio: "inherit", env: process.env });

function shutdown(code) {
  database.kill("SIGTERM");
  server.kill("SIGTERM");
  process.exit(code ?? 0);
}
server.on("exit", (code) => shutdown(code));
database.on("exit", () => {
  console.error(red("\nThe database stopped unexpectedly."));
  shutdown(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
