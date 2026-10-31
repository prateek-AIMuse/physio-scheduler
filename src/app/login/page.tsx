import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; as?: string }> }) {
  const { error, next, as } = await searchParams;
  return (
    <main className="auth split">
      <aside className="auth-photo">
        <Photo name="login" zoom />
        <blockquote>&ldquo;Every session brings you closer to moving without thinking about it.&rdquo;</blockquote>
      </aside>
      <div className="auth-main">
        <div className="auth-wrap">
          <Link href="/" className="auth-brand" style={{ textDecoration: "none" }}><Logo />{APP_NAME}</Link>
          <div className="card stack">
            <div>
              <h1>Welcome back</h1>
              <p className="muted">Patients: see your sessions and choose the times that suit you. Physios: manage your week.</p>
            </div>
            {error === "link" && <p className="notice error">That link has expired or was already used. Patients: log in with your phone number, or ask your physio for a new link. Physios who just confirmed their email: log in with your password.</p>}
            <LoginForm initialTab={as === "physio" ? "physio" : "patient"} next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />
          </div>
        </div>
      </div>
    </main>
  );
}
