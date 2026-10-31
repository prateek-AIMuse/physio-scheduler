"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Today", tab: true, icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/admin/calendar", label: "Calendar", tab: true, icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { href: "/admin/patients", label: "Patients", tab: true, icon: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8" },
  { href: "/admin/payments", label: "Payments", tab: true, icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
  { href: "/admin/messages", label: "Messages", tab: true, icon: "M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.6A8 8 0 1 1 21 12z" },
  { href: "/admin/exercises", label: "Exercises", tab: false, icon: "" },
  { href: "/admin/hours", label: "Hours", tab: false, icon: "" },
  { href: "/admin/settings", label: "Settings", tab: false, icon: "" },
];

const isCurrent = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/* Tabs under the header on wide screens; on phones, Hours and Settings stay there and the rest move to a bottom tab bar */
export function AdminNav({ toSend }: { toSend: number }) {
  const path = usePathname();
  const badge = (href: string) => href === "/admin/messages" && toSend > 0 && <span className="count" aria-label={`${toSend} to send`}>{toSend}</span>;
  return (
    <>
      <nav className="nav" aria-label="Sections">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={l.tab ? "desktop-tab" : ""} aria-current={isCurrent(path, l.href) ? "page" : undefined}>
            {l.label}{badge(l.href)}
          </Link>
        ))}
      </nav>
      <nav className="tabbar" aria-label="Main">
        {LINKS.filter((l) => l.tab).map((l) => (
          <Link key={l.href} href={l.href} aria-current={isCurrent(path, l.href) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={l.icon} /></svg>
            {l.label}{badge(l.href)}
          </Link>
        ))}
      </nav>
    </>
  );
}
