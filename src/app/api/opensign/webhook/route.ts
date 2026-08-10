import { NextResponse } from "next/server";
import { getSetting } from "@/lib/data";
import { pb } from "@/lib/pb";

/**
 * Receives signing events from OpenSign so a signed lease updates itself.
 *
 * Point OpenSign's webhook at:  https://your-app/api/opensign/webhook
 *
 * Set OPENSIGN_WEBHOOK_SECRET (or the opensign_webhook_secret setting) and send
 * it as `x-webhook-secret`; without a configured secret the endpoint refuses
 * requests rather than trusting anything that posts to it.
 */
export async function POST(request: Request) {
  const expected =
    process.env.OPENSIGN_WEBHOOK_SECRET?.trim() || await getSetting("opensign_webhook_secret");
  if (!expected) {
    return NextResponse.json(
      { error: "Webhook not enabled. Set OPENSIGN_WEBHOOK_SECRET first." },
      { status: 503 }
    );
  }
  if (request.headers.get("x-webhook-secret") !== expected) {
    return NextResponse.json({ error: "Bad secret" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = String(
    payload.objectId ?? payload.documentId ?? payload.document_id ?? ""
  );
  if (!documentId) {
    return NextResponse.json({ error: "No document id in payload" }, { status: 400 });
  }

  const event = String(payload.event ?? payload.status ?? "").toLowerCase();
  const isSigned =
    payload.isCompleted === true || event.includes("completed") || event.includes("signed");
  const isDeclined = payload.isDeclined === true || event.includes("declined");

  const client = await pb();
  const lease = await client
    .collection("leases")
    .getFirstListItem(`esign_document_id="${documentId.replace(/"/g, "")}"`)
    .catch(() => null);
  if (!lease) {
    // Not a document we know about — acknowledge so OpenSign stops retrying.
    return NextResponse.json({ ok: true, matched: false });
  }

  const documents = await client
    .collection("documents")
    .getFullList({ perPage: 50, filter: `lease="${lease.id}" && provider="opensign"` });

  if (isSigned) {
    await client.collection("leases").update(lease.id, { status: "signed" });
    for (const document of documents) {
      await client.collection("documents").update(document.id, {
        status: "signed",
        signed_at: new Date().toISOString().slice(0, 10),
      });
    }
  } else if (isDeclined) {
    for (const document of documents) {
      await client.collection("documents").update(document.id, { status: "sent" });
    }
  }

  return NextResponse.json({ ok: true, matched: true, leaseId: lease.id });
}
