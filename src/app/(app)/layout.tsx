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
    <div className="min-h-screen lg:flex">
      <Sidebar identity={identity} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 xl:px-10">{children}</main>
    </div>
  );
}
