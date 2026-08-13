"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setMenuMode } from "@/lib/actions";
import { ALL_GROUPS, SIMPLE, type NavItem } from "@/lib/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Row({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.hint}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-brand-600 font-medium text-white" : "hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="w-4 text-center text-base leading-none">{item.icon}</span>
      {item.label}
    </Link>
  );
}

export default function Sidebar({
  identity,
  mode = "simple",
}: {
  identity?: string | null;
  mode?: "simple" | "all";
}) {
  const pathname = usePathname();
  const showAll = mode === "all";

  // If you land on a page the short menu hides — a link from the dashboard, a
  // bookmark — it joins the menu for that visit, so you're never somewhere the
  // menu says doesn't exist.
  const here = ALL_GROUPS.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  const visiting = !showAll && here && !SIMPLE.some((i) => i.href === here.href) ? here : null;

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

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
        {showAll
          ? ALL_GROUPS.map((group) => (
              <div key={group.title} className="pb-1.5">
                <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {group.title}
                </div>
                {group.items.map((item) => (
                  <Row key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
              </div>
            ))
          : SIMPLE.map((item) => (
              <Row key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}

        {visiting && (
          <div className="mt-2 border-t border-white/10 pt-2">
            <Row item={visiting} active />
          </div>
        )}
      </nav>

      <form action={setMenuMode} className="px-3 pb-3">
        <input type="hidden" name="mode" value={showAll ? "simple" : "all"} />
        <button className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white">
          {showAll ? "Show less" : "Show all features"}
        </button>
      </form>

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
