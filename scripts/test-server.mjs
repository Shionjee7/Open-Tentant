/** Starts a disposable PocketBase and Next.js server for browser tests. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "opentenant-e2e-"));
process.env.DATA_DIR = testDataDir;
process.env.PB_PORT = "8190";
process.env.PB_URL = "http://127.0.0.1:8190";
process.env.PB_ADMIN_EMAIL = "e2e@opentenant.local";
process.env.PB_ADMIN_PASSWORD = "opentenant-e2e-password";
process.env.PORT = "3210";

const { prepare, serve, waitUntilHealthy } = await import("./pocketbase.mjs");
prepare();
const database = serve({ silent: true });
if (!(await waitUntilHealthy())) {
  database.kill("SIGTERM");
  throw new Error("The disposable PocketBase database did not start.");
}

const app = spawn("npm", ["run", "start"], {
  stdio: "inherit",
  env: process.env,
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  database.kill("SIGTERM");
  app.kill("SIGTERM");
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch {
    // The operating system can clear this temporary directory later.
  }
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
database.on("exit", (code) => {
  if (!stopping) stop(code || 1);
});
app.on("exit", (code) => stop(code || 0));
