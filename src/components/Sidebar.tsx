"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // If you land on a page the short menu hides — a link from the dashboard, a
  // bookmark — it joins the menu for that visit, so you're never somewhere the
  // menu says doesn't exist.
  const here = ALL_GROUPS.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  const visiting = !showAll && here && !SIMPLE.some((i) => i.href === here.href) ? here : null;

  const menu = (
    <aside
      id="main-menu"
      className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-[#18233a] text-slate-200 shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0 lg:shadow-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-xl text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          ×
        </button>
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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-xl text-ink-700"
          aria-label="Open menu"
          aria-controls="main-menu"
          aria-expanded={open}
        >
          ☰
        </button>
        <div>
          <div className="text-sm font-bold text-ink-900">OpenTenant</div>
          <div className="text-xs text-ink-500">{here?.label ?? "Home"}</div>
        </div>
      </header>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
      {menu}
    </>
  );
}
