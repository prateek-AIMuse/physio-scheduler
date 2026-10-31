import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";

/* The physio's header: brand, Owner and Log out, and the section menu */
export function AdminHeader({ practice, owner, toSend }: { practice: string; owner: boolean; toSend: number }) {
  return (
    <header className="top">
      <div className="top-row">
        <Link href="/admin" className="brand"><Logo /><span>{APP_NAME}<small>{practice} · Physio</small></span></Link>
        <div className="row top-actions">
          {owner && <Link href="/owner" className="btn sm">Owner</Link>}
          <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
        </div>
      </div>
      <AdminNav toSend={toSend} owner={owner} />
    </header>
  );
}
