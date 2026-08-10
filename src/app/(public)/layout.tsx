import Link from "next/link";
import { getSetting } from "@/lib/data";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const business = await getSetting("business_name", "OpenTenant");
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/listings" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
              {business.charAt(0).toUpperCase()}
            </span>
            <span className="font-bold text-ink-900">{business}</span>
          </Link>
          <span className="text-xs text-ink-500">Powered by OpenTenant — open source</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
