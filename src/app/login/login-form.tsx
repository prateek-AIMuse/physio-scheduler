"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { normalizePhone } from "@/lib/format";

export function LoginForm({ next, initialTab = "patient" }: { next: string; initialTab?: "patient" | "physio" }) {
  const router = useRouter();
  const [tab, setTab] = useState<"patient" | "physio">(initialTab);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); }
  }

  const sendCode = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const digits = normalizePhone(phone);
    if (!digits) throw new Error("Enter your mobile number, e.g. 98765 43210");
    const { error } = await browserClient().auth.signInWithOtp({ phone: `+${digits}`, options: { shouldCreateUser: false } });
    if (error) throw new Error(/signups? not allowed|not found/i.test(error.message)
      ? "This number isn't on a patient list. Ask your physio to add it."
      : /provider|sms|disabled/i.test(error.message)
      ? "Text-message codes aren't switched on yet. Ask your physio to send you a login link on WhatsApp."
      : error.message);
    setSentTo(digits);
  }); };

  const verify = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const { error } = await browserClient().auth.verifyOtp({ phone: `+${sentTo}`, token: code.trim(), type: "sms" });
    if (error) throw new Error("That code didn't work. Check it, or send a new one.");
    router.replace(next);
    router.refresh();
  }); };

  const physioLogin = (e: React.FormEvent) => { e.preventDefault(); run(async () => {
    const { error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("Wrong email or password.");
    router.replace(next === "/" ? "/admin" : next);
    router.refresh();
  }); };

  return (
    <div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "patient"} onClick={() => setTab("patient")}>Patient</button>
        <button type="button" role="tab" aria-selected={tab === "physio"} onClick={() => setTab("physio")}>Physio</button>
      </div>
      {error && <p className="notice error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
      {tab === "patient" && !sentTo && (
        <form onSubmit={sendCode} className="stack-sm">
          <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
          <button className="btn primary block" disabled={busy}>{busy ? "Sending…" : "Send me a code"}</button>
        </form>
      )}
      {tab === "patient" && sentTo && (
        <form onSubmit={verify} className="stack-sm">
          <p className="small muted">We sent a 6-digit code to +{sentTo}.</p>
          <label>Code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></label>
          <button className="btn primary block" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
          <button type="button" className="linkbtn small" onClick={() => { setSentTo(null); setCode(""); }}>Use a different number</button>
        </form>
      )}
      {tab === "physio" && (
        <form onSubmit={physioLogin} className="stack-sm">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button className="btn primary block" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          <p className="small muted" style={{ textAlign: "center" }}>New to Movera? <a href="/signup">Create a physio account</a></p>
        </form>
      )}
    </div>
  );
}
