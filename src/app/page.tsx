import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";

export default async function Home() {
  if (!supabaseConfigured()) {
    return (
      <main className="auth">
        <div className="card stack">
          <h1>Almost ready</h1>
          <p className="muted">Sign-in isn&apos;t set up yet. Add the Supabase keys described in the README, then reload.</p>
        </div>
      </main>
    );
  }
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "admin") redirect("/admin");
  if (viewer.role === "patient") redirect("/me");
  return (
    <main className="auth">
      <div className="card stack">
        <h1>We couldn&apos;t find you</h1>
        <p className="muted">
          You&apos;re signed in as {viewer.user.phone ? `+${viewer.user.phone}` : viewer.user.email}, but that isn&apos;t on the patient list.
          Ask your physio to add this number, or to send you a login link on WhatsApp.
        </p>
        <form action="/auth/signout" method="post"><button className="btn">Log out</button></form>
      </div>
    </main>
  );
}
