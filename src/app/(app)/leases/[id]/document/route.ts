import { renderLease } from "@/lib/lease-render";

/**
 * Serves the lease as a printable document — signatures and certificate of
 * completion included once it's been signed. Use the browser's "Save as PDF"
 * for a file to keep or send.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rendered = await renderLease(id);
  if (!rendered) return new Response("Lease not found", { status: 404 });

  return new Response(rendered.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
