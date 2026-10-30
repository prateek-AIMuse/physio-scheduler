"use client";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "install-dismissed";

/* Suggests adding the app to the home screen: a one-tap Install on Android, and the Share-menu steps on iPhone */
export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (ios) { const t = setTimeout(() => setMode("ios"), 0); return () => clearTimeout(t); }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); setMode("android"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch {} setMode(null); };
  return (
    <div className="install" role="note">
      <Logo />
      <div className="grow small">
        <p className="strong">Add to your home screen</p>
        {mode === "ios"
          ? <p className="muted">Tap <b>Share</b> <span aria-hidden>⎋</span> at the bottom of Safari, then <b>Add to Home Screen</b>.</p>
          : <p className="muted">Open your sessions in one tap, like an app.</p>}
      </div>
      {mode === "android" && event && (
        <button className="btn primary sm" onClick={async () => { await event.prompt(); await event.userChoice; dismiss(); }}>Install</button>
      )}
      <button className="btn sm" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
