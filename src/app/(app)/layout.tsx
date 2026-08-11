import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { SESSION_COOKIE, authGateEnabled, readSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let identity: string | null = null;
  if (authGateEnabled()) {
    const store = await cookies();
    identity = await readSession(store.get(SESSION_COOKIE)?.value);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar identity={identity} />
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
