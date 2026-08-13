import { createHash, randomUUID } from "node:crypto";
import type { Signature } from "./types";

/**
 * Signing, built in.
 *
 * OpenTenant generates the lease, so it can also collect the signatures. No
 * account, no second service, no per-document fee — the tenant gets a private
 * link, reads the lease, consents, signs, and the evidence lands next to the
 * lease it belongs to.
 *
 * What makes that a signature rather than a checkbox is the record kept
 * alongside it. The ESIGN Act and UETA ask for four things, and each one has a
 * field behind it:
 *
 *   1. Intent to sign        — they typed their name and pressed Sign.
 *   2. Consent to e-sign     — an explicit agreement, stored word for word.
 *   3. Attribution           — a link mailed to their address, plus IP and
 *                              user agent captured at the moment of signing.
 *   4. Record integrity      — a SHA-256 of the exact lease text they saw, so
 *                              an edit afterwards is detectable rather than
 *                              silent.
 *
 * None of that is legal advice, and some documents (wills, some notices) can't
 * be signed electronically at all. It is, however, the same evidence the
 * commercial services collect.
 */

export const CONSENT_TEXT =
  "I agree to sign this document electronically. I understand my electronic " +
  "signature is legally equivalent to a handwritten one, that I may instead " +
  "request a paper copy to sign by hand, and that I can withdraw this consent " +
  "at any time before signing.";

/** Signing links are the only credential, so they need real entropy. */
export function signingToken(): string {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
}

/**
 * A fingerprint of the lease as the signer saw it.
 *
 * Signatures and the completion certificate are stripped first, so the hash
 * stays stable as each party signs and only changes if the *terms* change.
 */
export function documentHash(html: string): string {
  const terms = html
    .replace(/<div class="sigs">[\s\S]*?<\/div>\s*(?=<p class="notice")/g, "")
    .replace(/<section class="certificate">[\s\S]*?<\/section>/g, "")
    .replace(/<div class="noprint">[\s\S]*?<\/div>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(terms).digest("hex");
}

/** First 16 characters, spaced — enough to compare by eye. */
export function shortHash(hash: string): string {
  return (hash || "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ").toUpperCase();
}

export function signingUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/sign/${token}`;
}

export type SigningProgress = {
  total: number;
  signed: number;
  pending: number;
  declined: number;
  complete: boolean;
  /** True once at least one person has signed but not everyone has. */
  partial: boolean;
};

export function signingProgress(signatures: Signature[]): SigningProgress {
  const live = signatures.filter((s) => s.status !== "cancelled");
  const signed = live.filter((s) => s.status === "signed").length;
  const declined = live.filter((s) => s.status === "declined").length;
  const pending = live.filter((s) => s.status === "pending").length;
  return {
    total: live.length,
    signed,
    pending,
    declined,
    complete: live.length > 0 && signed === live.length,
    partial: signed > 0 && signed < live.length,
  };
}

/**
 * Whether the lease still matches what everyone signed. A landlord who edits
 * rent after signing gets told, rather than quietly ending up with a document
 * that disagrees with its own signatures.
 */
export function tamperCheck(
  signatures: Signature[],
  currentHash: string
): { ok: boolean; signedHash: string } {
  const signed = signatures.filter((s) => s.status === "signed" && s.document_hash);
  if (signed.length === 0) return { ok: true, signedHash: "" };
  const signedHash = signed[0].document_hash;
  return { ok: signed.every((s) => s.document_hash === currentHash), signedHash };
}

/** The client address, as far as the proxy chain will admit. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "";
}
