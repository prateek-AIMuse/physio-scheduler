"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; icon: string };

/* Main sections: on phones these are the bottom tab bar */
const MAIN: Item[] = [
  { href: "/admin", label: "Today", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/admin/calendar", label: "Calendar", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { href: "/admin/patients", label: "Patients", icon: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8" },
  { href: "/admin/messages", label: "Messages", icon: "M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.6A8 8 0 1 1 21 12z" },
];
/* The rest: on phones these sit behind the More tab */
const MORE: Item[] = [
  { href: "/admin/payments", label: "Payments", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
  { href: "/admin/exercises", label: "Exercises", icon: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" },
  { href: "/admin/hours", label: "Hours", icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

const isCurrent = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);

/* Wide screens: every section in the top menu, wrapping onto a second line rather than hiding any.
   Phones: a bottom tab bar with the main sections and a More sheet for the rest, Owner and Log out. */
export function AdminNav({ toSend, owner }: { toSend: number; owner: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  /* Close the More sheet when the page changes */
  useEffect(() => { const t = setTimeout(() => setOpen(false), 0); return () => clearTimeout(t); }, [path]);
  const badge = (href: string) => href === "/admin/messages" && toSend > 0 && <span className="count" aria-label={`${toSend} to send`}>{toSend}</span>;
  const moreActive = MORE.some((m) => isCurrent(path, m.href));

  return (
    <>
      <nav className="nav" aria-label="Sections">
        {[...MAIN.slice(0, 3), MORE[0], MAIN[3], ...MORE.slice(1)].map((l) => (
          <Link key={l.href} href={l.href} aria-current={isCurrent(path, l.href) ? "page" : undefined}>{l.label}{badge(l.href)}</Link>
        ))}
      </nav>

      <nav className="tabbar" aria-label="Main">
        {MAIN.map((l) => (
          <Link key={l.href} href={l.href} aria-current={isCurrent(path, l.href) ? "page" : undefined}>
            <Icon d={l.icon} />{l.label}{badge(l.href)}
          </Link>
        ))}
        <button type="button" className={`tab-more ${moreActive || open ? "active" : ""}`} aria-expanded={open} aria-controls="more-sheet" onClick={() => setOpen((o) => !o)}>
          <Icon d="M4 6h16M4 12h16M4 18h16" />More
        </button>
      </nav>

      {open && <button type="button" className="sheet-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <div id="more-sheet" className={`more-sheet ${open ? "open" : ""}`} role="menu" aria-hidden={!open}>
        {MORE.map((l) => (
          <Link key={l.href} href={l.href} role="menuitem" tabIndex={open ? 0 : -1} aria-current={isCurrent(path, l.href) ? "page" : undefined}>
            <Icon d={l.icon} />{l.label}
          </Link>
        ))}
        {owner && <Link href="/owner" role="menuitem" tabIndex={open ? 0 : -1}><Icon d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z" />Owner</Link>}
        <form action="/auth/signout" method="post">
          <button role="menuitem" tabIndex={open ? 0 : -1} className="danger"><Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />Log out</button>
        </form>
      </div>
    </>
  );
}
