import Link from "next/link";
import { signUpPhysio } from "@/app/signup/actions";
import { Flash } from "@/components/flash";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Physio sign-up" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; sent?: string }> }) {
  const { sent, ...flash } = await searchParams;
  return (
    <main className="auth split">
      <aside className="auth-photo">
        <Photo name="clinic" zoom />
        <blockquote>Your calendar, packages and payments, handled, so you can focus on treating.</blockquote>
      </aside>
      <div className="auth-main">
        <div className="auth-wrap">
          <Link href="/" className="auth-brand" style={{ textDecoration: "none" }}><Logo />{APP_NAME}</Link>
          <div className="card stack">
            {sent ? (
              <>
                <h1>Check your email</h1>
                <p className="muted">We sent a confirmation link to <b>{sent}</b>. Open it to confirm your account.</p>
                <p className="muted">Then we&apos;ll review your sign-up. You&apos;ll be able to use {APP_NAME} as soon as it&apos;s approved, usually within a day.</p>
                <Link href="/login?as=physio" className="btn primary block">Go to login</Link>
              </>
            ) : (
              <>
                <div>
                  <h1>Join {APP_NAME} as a physio</h1>
                  <p className="muted">Plan your week, track packages, take UPI payments and send WhatsApp reminders.</p>
                </div>
                <Flash {...flash} />
                <form action={signUpPhysio} className="stack-sm">
                  <input type="hidden" name="back" value="/signup" />
                  <label>Your full name<input name="physio_name" required autoComplete="name" placeholder="Dr Priya Shah" /></label>
                  <label>Practice name<input name="practice_name" placeholder="e.g. Shah Physio Care (optional)" /></label>
                  <div className="fields">
                    <label>Mobile number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" /></label>
                    <label>City<input name="city" autoComplete="address-level2" placeholder="Mumbai" /></label>
                  </div>
                  <label>Registration number (optional)<input name="registration_no" placeholder="e.g. state council or IAP number" /></label>
                  <label>Email<input name="email" type="email" required autoComplete="email" /></label>
                  <div className="fields">
                    <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
                    <label>Confirm password<input name="password2" type="password" required minLength={8} autoComplete="new-password" /></label>
                  </div>
                  <label className="check"><input type="checkbox" name="terms" required /> I&apos;m a qualified physiotherapist</label>
                  <button className="btn primary block">Create my account</button>
                  <p className="small muted" style={{ textAlign: "center" }}>Already have an account? <Link href="/login?as=physio">Log in</Link></p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
