/* Server-side configuration. Pages check these so the app still builds and renders before the keys are set. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  cronSecret: process.env.CRON_SECRET ?? "",
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappTemplateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
};

/* The physio's login email(s), comma-separated */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const supabaseConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const whatsappApiConfigured = () => Boolean(env.whatsappToken && env.whatsappPhoneNumberId);
