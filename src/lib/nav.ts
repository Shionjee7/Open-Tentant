/**
 * The menu.
 *
 * Seven entries, and no second tier. It used to be seven plus a "Show all
 * features" toggle that revealed fourteen — which meant half the app lived
 * somewhere you had to go looking for, and the menu itself became a thing to
 * learn. Everything now hangs off one of these seven, one hop away, from the
 * page it belongs to: rent and banking and the books from Money, leases and
 * applications and documents from Tenants, setup and guides from Settings.
 *
 * The order is the order a landlord uses them, not the order the app was built
 * in. Labels are plain: "Rent", not "Payments"; "Repairs", not "Maintenance".
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** One-line hint, shown as a tooltip and on the phone menu. */
  hint?: string;
};

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "▦", hint: "This month at a glance" },
  { href: "/money", label: "Money", icon: "$", hint: "What you kept, month by month" },
  { href: "/payments", label: "Rent", icon: "◷", hint: "Who has paid and who hasn't" },
  { href: "/properties", label: "Properties", icon: "⌂", hint: "Your places, and the rooms in them" },
  { href: "/contacts", label: "Tenants", icon: "☺", hint: "Who lives where, leases, applications" },
  { href: "/maintenance", label: "Repairs", icon: "⚒︎", hint: "Requests from you or your tenants" },
  { href: "/settings", label: "Settings", icon: "⚙", hint: "Your details, email, lease terms, setup" },
];

/**
 * Pages that aren't in the menu but belong to something that is. Used to keep
 * the right entry lit and to title the phone header, so you always know where
 * you are even three levels down.
 */
const BELONGS_TO: [string, string][] = [
  ["/banking", "/money"],
  ["/accounting", "/money"],
  ["/reports", "/money"],
  ["/leases", "/contacts"],
  ["/applications", "/contacts"],
  ["/documents", "/contacts"],
  ["/condition-reports", "/contacts"],
  ["/signing-app", "/contacts"],
  ["/start", "/settings"],
  ["/resources", "/settings"],
];

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Which menu entry owns this page — directly, or as one of its children. */
export function activeItem(pathname: string): NavItem | undefined {
  const direct = NAV.find((item) => matches(pathname, item.href));
  if (direct) return direct;
  const parent = BELONGS_TO.find(([child]) => matches(pathname, child));
  return parent ? NAV.find((item) => item.href === parent[1]) : undefined;
}

export const MENU_COOKIE = "opentenant_menu";
