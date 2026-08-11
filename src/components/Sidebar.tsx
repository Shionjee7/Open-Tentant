"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/properties", label: "Properties", icon: "⌂" },
  { href: "/contacts", label: "Leads & Tenants", icon: "☺" },
  { href: "/applications", label: "Applications", icon: "✎" },
  { href: "/leases", label: "Leases", icon: "§" },
  { href: "/payments", label: "Payments", icon: "$" },
  { href: "/banking", label: "Banking & Deposits", icon: "≡" },
  { href: "/maintenance", label: "Maintenance", icon: "⚒" },
  { href: "/documents", label: "Documents & E-Sign", icon: "✍" },
  { href: "/condition-reports", label: "Condition Reports", icon: "☑" },
  { href: "/accounting", label: "Accounting", icon: "Σ" },
  { href: "/resources", label: "Resources", icon: "?" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ identity }: { identity?: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-[#0f1b33] text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-white">
          O
        </span>
        <div>
          <div className="text-sm font-bold text-white">OpenTenant</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400">
            Free · Open Source
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-600 font-medium text-white"
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-4 text-center text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
        <Link href="/listings" className="hover:text-white" target="_blank">
          View public listings ↗
        </Link>
        {identity && (
          <form action="/api/auth/signout" method="POST" className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate" title={identity}>{identity}</span>
            <button className="shrink-0 text-slate-400 hover:text-white hover:underline">Sign out</button>
          </form>
        )}
      </div>
    </aside>
  );
}
