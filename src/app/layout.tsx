import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "OpenTenant — Free, open-source property management",
    template: "%s · OpenTenant",
  },
  description:
    "Self-hosted, open-source property management for landlords: listings, applications, screening, leases, payments, maintenance, and accounting — free forever.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
