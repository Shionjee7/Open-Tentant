/**
 * Moves the version on, in both places that hold it.
 *
 * The version lives twice: package.json, because that is where a Node project
 * keeps it, and web/version.js, because the browser app has no build step and
 * cannot read package.json. Two copies of one fact drift apart the first time
 * someone edits one by hand — so nobody edits either by hand.
 *
 *   npm run bump              patch: 0.2.0 → 0.2.1
 *   npm run bump minor        0.2.1 → 0.3.0
 *   npm run bump major        0.3.0 → 1.0.0
 *   npm run bump 1.4.2        straight to a version you name
 *   npm run version:check     fails if the two have drifted apart
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = path.join(root, "package.json");
const MODULE = path.join(root, "web", "version.js");

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function readVersions() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE, "utf8"));
  const module = fs.readFileSync(MODULE, "utf8");
  const match = module.match(/export const VERSION = "([^"]+)";/);
  return { package: pkg.version, module: match?.[1] ?? null };
}

export function next(current, how) {
  if (SEMVER.test(how)) return how;

  const parts = current.match(SEMVER);
  if (!parts) throw new Error(`"${current}" is not a version I can move on from.`);
  const [major, minor, patch] = parts.slice(1).map(Number);

  if (how === "major") return `${major + 1}.0.0`;
  if (how === "minor") return `${major}.${minor + 1}.0`;
  if (how === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Say patch, minor, major, or a version like 1.4.2 — not "${how}".`);
}

export function write(version) {
  // package.json is rewritten by hand rather than re-serialised wholesale, so
  // the file keeps its own formatting and the diff is one line.
  const pkg = fs.readFileSync(PACKAGE, "utf8");
  fs.writeFileSync(PACKAGE, pkg.replace(/("version":\s*)"[^"]+"/, `$1"${version}"`));

  const module = fs.readFileSync(MODULE, "utf8");
  fs.writeFileSync(MODULE, module.replace(/(export const VERSION = )"[^"]+"/, `$1"${version}"`));
}

function main() {
  const argument = process.argv[2] ?? "patch";
  const versions = readVersions();

  if (argument === "--check") {
    if (versions.package === versions.module) {
      console.log(`Version ${versions.package}, and both places agree.`);
      return;
    }
    console.error(
      `Version drift: package.json says ${versions.package}, web/version.js says ${versions.module}.\n` +
        `Run "npm run bump <version>" rather than editing either by hand.`
    );
    process.exit(1);
  }

  if (versions.package !== versions.module) {
    console.error(
      `Refusing to bump: package.json says ${versions.package} but web/version.js says ${versions.module}.\n` +
        `Fix the drift first with "npm run bump ${versions.package}".`
    );
    process.exit(1);
  }

  const version = next(versions.package, argument);
  write(version);
  console.log(`${versions.package} → ${version}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
