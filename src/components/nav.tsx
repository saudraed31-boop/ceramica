import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/search-jobs", label: "Search Jobs" },
  { href: "/leads", label: "Leads" },
  { href: "/leads?temperature=HOT", label: "Hot Leads" },
  { href: "/accounts", label: "Accounts" },
  { href: "/outreach", label: "Outreach" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <nav className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="mb-6 px-2">
        <div className="text-sm font-semibold tracking-wide text-[var(--gold)]">CERAMICA</div>
        <div className="text-xs text-[var(--text-muted)]">Lead Generator</div>
      </div>
      <ul className="space-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-md px-2 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--ink-soft)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
