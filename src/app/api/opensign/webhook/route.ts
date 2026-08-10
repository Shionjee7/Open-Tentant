import { NextResponse } from "next/server";
import { getDb, getSetting } from "@/lib/db";

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
    process.env.OPENSIGN_WEBHOOK_SECRET?.trim() || getSetting("opensign_webhook_secret");
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

  const db = getDb();
  const lease = db
    .prepare("SELECT id FROM leases WHERE esign_document_id = ?")
    .get(documentId) as { id: number } | undefined;
  if (!lease) {
    // Not a document we know about — acknowledge so OpenSign stops retrying.
    return NextResponse.json({ ok: true, matched: false });
  }

  if (isSigned) {
    db.prepare("UPDATE leases SET status = 'signed' WHERE id = ?").run(lease.id);
    db.prepare(
      `UPDATE documents SET status = 'signed', signed_at = datetime('now')
       WHERE lease_id = ? AND provider = 'opensign'`
    ).run(lease.id);
  } else if (isDeclined) {
    db.prepare(
      "UPDATE documents SET status = 'sent' WHERE lease_id = ? AND provider = 'opensign'"
    ).run(lease.id);
  }

  return NextResponse.json({ ok: true, matched: true, leaseId: lease.id });
}
