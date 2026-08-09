import Link from "next/link";

export const metadata = { title: "Application received" };

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="mt-4 text-2xl font-bold">Application received!</h1>
      <p className="mt-2 text-sm text-ink-500">
        Thanks for applying. The property manager will review your application and reach out —
        usually within a couple of days.
      </p>
      <Link href="/listings" className="btn mt-6">Back to listings</Link>
    </div>
  );
}
