"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, activeItem } from "@/lib/nav";

/**
 * One flat menu, always the same seven entries in the same order.
 *
 * Nothing expands, nothing hides, and a page that isn't in the menu still
 * lights up the entry it belongs to — so the menu never claims you're
 * somewhere you aren't.
 */
export default function Sidebar({ identity }: { identity?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const here = activeItem(pathname);

  useEffect(() => setOpen(false), [pathname]);

  const menu = (
    <aside
      id="main-menu"
      className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-[#101c33] text-slate-300 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[15rem] lg:translate-x-0 lg:shadow-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white shadow-sm">
          O
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight text-white">OpenTenant</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Free · Open Source
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map((item) => {
          const active = here?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.hint}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <span
                className={`w-5 text-center text-[15px] leading-none ${
                  active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                }`}
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                {item.hint && (
                  <span
                    className={`block truncate text-[11px] lg:hidden ${
                      active ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {item.hint}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
        <Link href="/listings" className="hover:text-white" target="_blank">
          View public listings ↗
        </Link>
        {identity && (
          <form
            action="/api/auth/signout"
            method="POST"
            className="mt-2 flex items-center justify-between gap-2"
          >
            <span className="truncate" title={identity}>
              {identity}
            </span>
            <button className="shrink-0 text-slate-400 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-xl text-ink-700"
          aria-label="Open menu"
          aria-controls="main-menu"
          aria-expanded={open}
        >
          ☰
        </button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-tight text-ink-900">
            {here?.label ?? "OpenTenant"}
          </div>
          <div className="truncate text-xs text-ink-500">{here?.hint ?? "Property management"}</div>
        </div>
      </header>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}
      {menu}
    </>
  );
}
