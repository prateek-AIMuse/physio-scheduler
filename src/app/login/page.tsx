import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { getPublicSettings } from "@/lib/settings";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const [{ error, next }, s] = await Promise.all([searchParams, getPublicSettings()]);
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
              <p className="muted">Log in to see your sessions{s.clinic_name ? ` at ${s.clinic_name} or at home` : ""}, and choose the times that suit you.</p>
            </div>
            {error === "link" && <p className="notice error">That login link has expired or was already used. Log in with your phone number, or ask your physio for a new link.</p>}
            <LoginForm next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />
          </div>
        </div>
      </div>
    </main>
  );
}
