import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { SESSION_COOKIE, authGateEnabled, readSession } from "@/lib/auth";
import { MENU_COOKIE } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();

  let identity: string | null = null;
  if (authGateEnabled()) {
    identity = await readSession(store.get(SESSION_COOKIE)?.value);
  }

  // Short menu unless you've asked for the full one.
  const mode = store.get(MENU_COOKIE)?.value === "all" ? "all" : "simple";

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar identity={identity} mode={mode} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
