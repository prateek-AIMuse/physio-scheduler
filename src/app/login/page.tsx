import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="auth">
      <div className="card stack">
        <div>
          <h1>Physio sessions</h1>
          <p className="muted">Log in to see your sessions and choose the times that suit you.</p>
        </div>
        {error === "link" && <p className="notice error">That login link has expired or was already used. Log in with your phone number, or ask your physio for a new link.</p>}
        <LoginForm next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />
      </div>
    </main>
  );
}
