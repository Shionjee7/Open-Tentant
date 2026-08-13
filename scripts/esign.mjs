#!/usr/bin/env node
/**
 * Starts the bundled signing app:
 *
 *   npm run esign
 *
 * OpenSign runs as extra containers next to OpenTenant, storing documents on
 * this machine. This script generates the secrets it needs the first time
 * (they go in .env and are never regenerated), then brings the containers up
 * and waits until the app answers.
 *
 * Leases don't need any of this — OpenTenant signs those itself. This is for
 * signing documents that aren't leases.
 */

import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

const bold = (s) => `[1m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const red = (s) => `[31m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;

function docker(args, options = {}) {
  return spawnSync("docker", args, { cwd: root, stdio: "inherit", ...options });
}

// --- 1. Docker present? ----------------------------------------------------
try {
  execFileSync("docker", ["compose", "version"], { stdio: "ignore" });
} catch {
  console.error(`
${red("Docker isn't available.")}

The signing app runs as containers, so it needs Docker Desktop (Mac/Windows)
or Docker Engine (Linux): https://docs.docker.com/get-docker/

You don't need it to sign leases — that works already. Open any lease and
press "Send for signature".
`);
  process.exit(1);
}

// --- 2. Secrets ------------------------------------------------------------
// Kept in .env so they survive restarts; regenerating them would orphan every
// document already signed through OpenSign.
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const has = (key) => new RegExp(`^${key}=.+$`, "m").test(existing);

// Only the master key. OpenSign's app id is baked into the published client
// image, so it isn't ours to choose.
const additions = [];
if (!has("OPENSIGN_MASTER_KEY")) {
  additions.push(`OPENSIGN_MASTER_KEY=${crypto.randomBytes(24).toString("base64url")}`);
}

if (additions.length > 0) {
  const header = existing.includes("# Signing app") ? "" : "\n# Signing app (OpenSign)\n";
  fs.appendFileSync(envPath, `${existing && !existing.endsWith("\n") ? "\n" : ""}${header}${additions.join("\n")}\n`);
  console.log(`${green("✓")} Generated the signing master key in .env`);
} else {
  console.log(`${green("✓")} Signing master key already in .env`);
}

// --- 3. Up -----------------------------------------------------------------
console.log(`\n${bold("→")} Starting the signing app ${dim("(first run downloads a few hundred MB)")}…`);
// Only the signing containers, never the opentenant service — most people run
// the app with `npm run setup`, and starting a second copy in Docker would
// fight it for port 3000.
const up = docker([
  "compose",
  "--profile",
  "esign",
  "up",
  "-d",
  "opensign-db",
  "opensign-server",
  "opensign-client",
  "opensign-proxy",
]);
if (up.status !== 0) {
  console.error(`\n${red("Couldn't start the containers.")} The output above says why.`);
  process.exit(up.status ?? 1);
}

// --- 4. Wait for it --------------------------------------------------------
const url = process.env.OPENSIGN_APP_URL || "http://localhost:3001";
process.stdout.write(`\n${bold("→")} Waiting for ${url} `);

let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
    if (response.status < 500) {
      ready = true;
      break;
    }
  } catch {
    // not up yet
  }
  process.stdout.write(".");
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log("");

if (!ready) {
  console.error(`
${red("The signing app didn't answer in time.")}

It may still be starting — the first run unpacks a database. Check with:

    docker compose --profile esign logs -f opensign-server

then reload ${bold("Signing app")} in OpenTenant.
`);
  process.exit(1);
}

console.log(`
${green(bold("The signing app is running."))}

  In OpenTenant   ${bold("Signing app")} in the menu ${dim("(under Show all features)")}
  Direct          ${bold(url)}

  First visit asks you to create an account — it's local to this machine.

  ${dim("Stop it with: docker compose --profile esign down")}
`);
