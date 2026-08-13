/**
 * The menu.
 *
 * A landlord renting out a few rooms touches five or six screens; the rest are
 * for specific moments — filling a vacancy, signing a lease, a move-out
 * walkthrough. So the short menu is the default and everything else sits
 * behind "Show all", grouped by when you'd actually reach for it.
 *
 * Labels are deliberately plain: "Rent" rather than "Payments", "Tenants"
 * rather than "Leads & Tenants".
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** One-line hint shown in the full menu, so nothing is a mystery. */
  hint?: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** What you use most weeks. */
export const EVERYDAY: NavItem[] = [
  { href: "/", label: "Home", icon: "▦", hint: "How everything is doing right now" },
  { href: "/properties", label: "Properties", icon: "⌂", hint: "Your places, and the rooms in them" },
  { href: "/contacts", label: "Tenants", icon: "☺", hint: "Who lives where, and their portal links" },
  { href: "/payments", label: "Rent", icon: "$", hint: "What's due, what's paid, month-end receipts" },
  { href: "/maintenance", label: "Repairs", icon: "⚒︎", hint: "Requests from you or your tenants" },
];

/** Everything, grouped by the moment you need it. */
export const ALL_GROUPS: NavGroup[] = [
  { title: "Everyday", items: EVERYDAY },
  {
    title: "Filling a vacancy",
    items: [
      { href: "/applications", label: "Applications", icon: "✎", hint: "People applying to rent from you" },
      { href: "/leases", label: "Leases", icon: "§", hint: "Write, send, and sign the lease" },
      { href: "/documents", label: "Documents", icon: "✍︎", hint: "Leases and notices, and their signing status" },
      { href: "/signing-app", label: "Signing app", icon: "✒︎", hint: "OpenSign, for signing anything that isn't a lease" },
      { href: "/condition-reports", label: "Condition reports", icon: "☑︎", hint: "Move-in and move-out walkthroughs" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/banking", label: "Bank deposits", icon: "≡", hint: "Upload a statement, match it to tenants" },
      { href: "/accounting", label: "Accounting", icon: "Σ", hint: "Income, expenses, and what's ahead" },
    ],
  },
  {
    title: "Setup & help",
    items: [
      { href: "/start", label: "Start here", icon: "◎", hint: "The step-by-step setup" },
      { href: "/resources", label: "How-to guides", icon: "?", hint: "Screening, rent, rooms, reconciling" },
      { href: "/settings", label: "Settings", icon: "⚙", hint: "Your details, email, lease terms, sign-in" },
    ],
  },
];

/** The short menu: everyday items, plus the two you always need to reach. */
export const SIMPLE: NavItem[] = [
  ...EVERYDAY,
  { href: "/start", label: "Start here", icon: "◎" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export const MENU_COOKIE = "opentenant_menu";
