import { getSetting } from "./data";

/**
 * OpenSign integration.
 *
 * Two modes, chosen automatically:
 *
 * 1. **Guided (free).** The free self-hosted OpenSign app does everything a
 *    landlord needs through its own UI, but its REST API is a paid feature. So
 *    without a token we generate the lease, hand it to you, and deep-link
 *    straight into your OpenSign instance to upload and send — then you paste
 *    the signing link back so status lives with the lease.
 *
 * 2. **Automatic (API).** If an API token is configured — OpenSign cloud, or a
 *    paid self-hosted plan — the app creates the document, adds the signers,
 *    and stores the signing URL without leaving OpenTenant.
 *
 * Everything the app does works in mode 1; mode 2 only removes manual steps.
 */

export type OpenSignConfig = {
  /** Base URL of the OpenSign app you use for signing. */
  appUrl: string;
  /** API base, e.g. https://app.opensignlabs.com/api/v1.2 — blank in guided mode. */
  apiUrl: string;
  /** API token; blank in guided mode. */
  token: string;
};

export async function openSignConfig(): Promise<OpenSignConfig> {
  return {
    appUrl:
      process.env.OPENSIGN_APP_URL?.trim() ||
      (await getSetting("esign_base_url")) ||
      "https://app.opensignlabs.com",
    apiUrl:
      process.env.OPENSIGN_API_URL?.trim() ||
      (await getSetting("opensign_api_url")) ||
      "https://app.opensignlabs.com/api/v1.2",
    token:
      process.env.OPENSIGN_API_TOKEN?.trim() || (await getSetting("opensign_api_token")),
  };
}

export async function hasApiAccess(): Promise<boolean> {
  return Boolean((await openSignConfig()).token);
}

export type SignerInput = {
  name: string;
  email: string;
};

export type CreateDocumentResult =
  | { ok: true; documentId: string; signingUrl: string }
  | { ok: false; error: string };

/**
 * Creates a document in OpenSign from a base64 file and requests signatures.
 * Only reachable when a token is configured.
 */
export async function createSignatureRequest(options: {
  title: string;
  base64File: string;
  fileName: string;
  signers: SignerInput[];
  message?: string;
}): Promise<CreateDocumentResult> {
  const config = await openSignConfig();
  if (!config.token) {
    return { ok: false, error: "No OpenSign API token configured." };
  }

  try {
    const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}/createdocument`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": config.token,
      },
      body: JSON.stringify({
        title: options.title,
        file: options.base64File,
        fileName: options.fileName,
        note: options.message ?? "Please review and sign your lease.",
        signers: options.signers.map((s, index) => ({
          name: s.name,
          email: s.email,
          order: index + 1,
        })),
        sendInOrder: false,
        sendEmail: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `OpenSign returned ${response.status}. ${text.slice(0, 300)}`,
      };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "OpenSign returned a response we couldn't read." };
    }

    const documentId = String(payload.objectId ?? payload.documentId ?? payload.id ?? "");
    const signingUrl = String(payload.signurl ?? payload.signUrl ?? payload.url ?? "");
    if (!documentId && !signingUrl) {
      return { ok: false, error: "OpenSign didn't return a document id or signing link." };
    }

    return {
      ok: true,
      documentId,
      signingUrl: signingUrl || `${config.appUrl.replace(/\/$/, "")}/load/recipientSignPdf/${documentId}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, error: `Couldn't reach OpenSign: ${message}` };
  }
}

/** Looks up a document's signing status. Returns null when unavailable. */
export async function fetchDocumentStatus(
  documentId: string
): Promise<{ status: string; signedAt: string | null } | null> {
  const config = await openSignConfig();
  if (!config.token || !documentId) return null;

  try {
    const response = await fetch(
      `${config.apiUrl.replace(/\/$/, "")}/document/${encodeURIComponent(documentId)}`,
      {
        headers: { "x-api-token": config.token },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, unknown>;

    const completed =
      payload.isCompleted === true ||
      payload.IsCompleted === true ||
      String(payload.status ?? "").toLowerCase() === "completed" ||
      String(payload.status ?? "").toLowerCase() === "signed";

    const declined =
      payload.isDeclined === true || String(payload.status ?? "").toLowerCase() === "declined";

    return {
      status: completed ? "signed" : declined ? "declined" : "sent",
      signedAt: completed
        ? String(payload.completedAt ?? payload.updatedAt ?? new Date().toISOString()).slice(0, 10)
        : null,
    };
  } catch {
    return null;
  }
}

/** Link to your OpenSign instance, where you upload the lease and send it. */
export async function openSignAppUrl(): Promise<string> {
  return (await openSignConfig()).appUrl.replace(/\/$/, "");
}
