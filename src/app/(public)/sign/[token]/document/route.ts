import { getSignatureByToken } from "@/lib/data";
import { renderLease } from "@/lib/lease-render";

/**
 * The document behind a signing link, for the signer's own review.
 *
 * The token is the only credential — same model as the tenant portal — so it
 * is never indexed and never cached.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signature = await getSignatureByToken(token);
  if (!signature) return new Response("This signing link is not valid.", { status: 404 });

  const rendered = await renderLease(signature.lease);
  if (!rendered) return new Response("Lease not found", { status: 404 });

  return new Response(rendered.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
