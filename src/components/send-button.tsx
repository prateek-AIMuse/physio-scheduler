"use client";
import { useRouter } from "next/navigation";

/* Opens WhatsApp in a new tab, then refreshes this page so the message shows as sent */
export function SendButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <a className="btn wa sm" href={`/admin/send/${id}`} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => router.refresh(), 1500)}>
      Send on WhatsApp
    </a>
  );
}
