import type { Location } from "@/lib/scheduler";

/* A practice's mini website: what the physio fills in under Website, shown at /<slug> */
export type Service = { name: string; minutes: number; price: number | null; where: Location | "both" };

export type PracticePage = {
  practice_id: string;
  slug: string | null;
  published: boolean;
  headline: string;
  about: string;
  qualifications: string;
  specialities: string;
  home_areas: string;
  services: Service[];
  show_whatsapp: boolean;
  accept_bookings: boolean;
};

export type BookingRequest = {
  id: string;
  practice_id: string;
  full_name: string;
  phone: string;
  service: string;
  starts_at: string;
  ends_at: string;
  location: Location;
  address: string;
  note: string;
  status: "new" | "accepted" | "declined";
  patient_id: string | null;
  visit_id: string | null;
  created_at: string;
};

export const MAX_SERVICES = 6;
export const DEFAULT_SERVICE: Service = { name: "Physiotherapy session", minutes: 60, price: null, where: "both" };

/* Addresses the app itself uses, or might: a page can't take these */
const RESERVED = new Set([
  "admin", "api", "auth", "me", "owner", "login", "logout", "signup", "signin", "pending", "pay", "p", "book",
  "images", "icons", "static", "public", "assets", "manifest", "sw", "offline", "favicon", "robots", "sitemap",
  "pricing", "plans", "about", "contact", "help", "support", "terms", "privacy", "blog", "physio", "physios",
  "patient", "patients", "clinic", "clinics", "movera", "app", "www", "home", "settings", "new", "null", "undefined",
]);

/* "Dr. Priya Shah" → "dr-priya-shah" */
export const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");

/* Why this address can't be used, or null if it can */
export function slugError(slug: string): string | null {
  if (slug.length < 3) return "The page address needs at least 3 letters or numbers";
  if (slug.length > 40) return "The page address can be at most 40 characters";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "The page address can only have small letters, numbers and hyphens";
  if (RESERVED.has(slug)) return "That address is used by the app. Please choose another";
  return null;
}

const whereOf = (w: unknown): Service["where"] => (w === "clinic" || w === "home" ? w : "both");

/* Services as saved (or typed): drops empty rows and anything out of range */
export function cleanServices(input: unknown): Service[] {
  if (!Array.isArray(input)) return [];
  const out: Service[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = String(r.name ?? "").trim().slice(0, 60);
    const minutes = Math.round(Number(r.minutes));
    if (!name || !Number.isFinite(minutes) || minutes < 15 || minutes > 180) continue;
    const price = r.price === null || r.price === undefined || r.price === "" ? null : Number(r.price);
    out.push({ name, minutes, price: price !== null && Number.isFinite(price) && price >= 0 ? price : null, where: whereOf(r.where) });
    if (out.length === MAX_SERVICES) break;
  }
  return out;
}

/* What visitors can book: the physio's services, or one plain session if none are set up */
export const bookableServices = (page: Pick<PracticePage, "services">) => (page.services.length ? page.services : [DEFAULT_SERVICE]);

export const offers = (s: Service, where: Location) => s.where === "both" || s.where === where;

/* "Sports rehab, Post-surgery ,  " → ["Sports rehab", "Post-surgery"] */
export const tags = (s: string) => s.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 12);

export const initials = (name: string) =>
  name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "PT";
