import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Waiting for approval" };

/* Where a physio lands until the platform owner approves their practice */
export default async function Pending() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?as=physio");
  if (viewer.role !== "physio") redirect("/");
  if (viewer.practice.status === "approved") redirect("/admin");
  const suspended = viewer.practice.status === "suspended";
  return (
    <main className="auth">
      <div className="auth-main">
        <div className="auth-wrap">
          <p className="auth-brand"><Logo />{APP_NAME}</p>
          <div className="card stack">
            <h1>Welcome, {viewer.practice.physio_name || viewer.user.email}</h1>
            {suspended ? (
              <p className="muted">Your practice has been paused. Please contact the {APP_NAME} team to restore access.</p>
            ) : (
              <>
                <p className="muted">Thanks for signing up. Your account is waiting for approval, which usually takes less than a day.</p>
                <p className="muted">Once it&apos;s approved, log in again to set up your hours, add patients and plan your first week.</p>
              </>
            )}
            {viewer.owner && <Link href="/owner" className="btn primary block">Open the owner page</Link>}
            <form action="/auth/signout" method="post"><button className="btn block">Log out</button></form>
          </div>
        </div>
      </div>
    </main>
  );
}
