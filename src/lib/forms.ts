import { redirect } from "next/navigation";

/* Server actions report back through the URL, so every page works without client-side JavaScript */
export function back(fd: FormData, fallback: string, message: { ok?: string; error?: string }): never {
  const raw = String(fd.get("back") ?? "");
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  if (message.ok) url.searchParams.set("ok", message.ok);
  if (message.error) url.searchParams.set("error", message.error);
  redirect(`${url.pathname}${url.search}${url.hash}`);
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
