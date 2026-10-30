import { env, whatsappApiConfigured } from "@/lib/env";
import type { MessageKind } from "@/lib/types";

/* Opens WhatsApp (app or web) with the message typed in, ready for the physio to press Send */
export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/* WhatsApp Cloud API: messages the business starts must use a template Meta has approved.
   The template names and their {{1}}, {{2}}… values are listed in the README. */
const TEMPLATES: Record<MessageKind, string> = {
  day_reminder: "visit_reminder",
  weekly_summary: "weekly_schedule",
  payment_request: "payment_request",
  login_link: "login_link",
  custom: "",
};

export async function sendTemplate(phone: string, kind: MessageKind, params: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!whatsappApiConfigured()) return { ok: false, error: "WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID aren't set" };
  const name = TEMPLATES[kind];
  if (!name) return { ok: false, error: "This message has no template; send it by hand" };
  /* Template values can't contain new lines, tabs or more than four spaces in a row */
  const clean = params.map((p) => p.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   "));
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name,
          language: { code: env.whatsappTemplateLanguage },
          components: [{ type: "body", parameters: clean.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: body?.error?.message ?? `WhatsApp returned ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reach WhatsApp" };
  }
}
