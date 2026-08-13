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
    <div className="flex min-h-screen">
      <Sidebar identity={identity} mode={mode} />
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
