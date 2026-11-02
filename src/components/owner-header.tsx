import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/brand";

/* Header for the platform owner's pages */
export function OwnerHeader({ physio }: { physio: boolean }) {
  return (
    <header className="top">
      <div className="top-row">
        <Link href="/owner" className="brand"><Logo /><span>{APP_NAME}<small>Platform owner</small></span></Link>
        <div className="row">
          {physio && <Link href="/admin" className="btn sm">My practice</Link>}
          <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form>
        </div>
      </div>
    </header>
  );
}
