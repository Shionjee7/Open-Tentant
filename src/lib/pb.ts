import PocketBase from "pocketbase";

/**
 * PocketBase connection.
 *
 * PocketBase runs as a separate process alongside the app (started for you by
 * `npm run setup`, or as its own container in Docker). The Next.js server talks
 * to it as a superuser over localhost, so every collection rule stays closed to
 * anonymous callers — the app is the only client.
 */

// PB_URL wins when PocketBase runs elsewhere; otherwise follow PB_PORT so
// changing the port in one place moves both the server and this client.
const PB_URL =
  process.env.PB_URL?.trim() || `http://127.0.0.1:${process.env.PB_PORT?.trim() || "8090"}`;
const PB_EMAIL = process.env.PB_ADMIN_EMAIL?.trim() || "admin@opentenant.local";
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD?.trim() || "opentenant-local-dev";

declare global {
  // eslint-disable-next-line no-var
  var __opentenant_pb: PocketBase | undefined;
}

function client(): PocketBase {
  if (!globalThis.__opentenant_pb) {
    const pb = new PocketBase(PB_URL);
    // The app holds one long-lived connection; PocketBase's SDK would otherwise
    // cancel an in-flight request when an identical one starts.
    pb.autoCancellation(false);
    globalThis.__opentenant_pb = pb;
  }
  return globalThis.__opentenant_pb;
}

/** Returns an authenticated client, signing in as superuser when needed. */
export async function pb(): Promise<PocketBase> {
  const instance = client();
  if (!instance.authStore.isValid) {
    await instance
      .collection("_superusers")
      .authWithPassword(PB_EMAIL, PB_PASSWORD);
  }
  return instance;
}

export class PocketBaseUnavailable extends Error {
  constructor(cause: unknown) {
    super(
      `Can't reach PocketBase at ${PB_URL}. Start it with \`npm run setup\`, ` +
        `or set PB_URL if it runs elsewhere.`
    );
    this.name = "PocketBaseUnavailable";
    this.cause = cause;
  }
}

/** True when PocketBase answers — used by the setup script and health checks. */
export async function pbReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${PB_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const PB_PUBLIC_URL = PB_URL;
