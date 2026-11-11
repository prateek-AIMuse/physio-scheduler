"use server";
import { redirect } from "next/navigation";
import { openTimes } from "@/lib/booking";
import { str } from "@/lib/forms";
import { normalizePhone } from "@/lib/format";
import { bookableServices, offers } from "@/lib/practice-page";
import { getPublicPractice } from "@/lib/public-practice";
import type { Location } from "@/lib/scheduler";

/* Most requests one practice can have waiting from the last day: a public form needs a ceiling */
const DAILY_LIMIT = 30;

/* A visitor on a practice's page asks for a time. Nothing is booked yet: the request holds the time
   until the physio accepts or declines it on their Today page. */
export async function requestBooking(fd: FormData) {
  const slug = str(fd, "slug");
  const found = await getPublicPractice(slug);
  if (!found) redirect("/");
  const { page, db, settings: s } = found;
  const serviceIndex = Number(str(fd, "service")) || 0;
  const where: Location = str(fd, "where") === "home" ? "home" : "clinic";
  const startIso = str(fd, "start");
  const here = `/${slug}?service=${serviceIndex}&where=${where}`;
  const fail = (error: string, keepTime = true): never =>
    redirect(`${here}${keepTime ? `&start=${encodeURIComponent(startIso)}` : ""}&error=${encodeURIComponent(error)}#book`);

  if (!page.accept_bookings) fail("Online booking is switched off for this practice. Please message them instead.", false);
  /* A field people never see: only scripts fill it in */
  if (str(fd, "website")) redirect(`/${slug}?sent=1#book`);
  const service = bookableServices(page)[serviceIndex];
  if (!service || !offers(service, where)) fail("Please choose a service again.", false);

  const name = str(fd, "full_name").slice(0, 80), address = str(fd, "address").slice(0, 300), note = str(fd, "note").slice(0, 500);
  const phone = normalizePhone(str(fd, "phone"), s.country_code);
  if (name.length < 2) fail("Please enter your name.");
  if (!phone) fail("Please enter a valid mobile number, with the country code if it isn't a local number.");
  if (where === "home" && address.length < 5) fail("Please enter the address for the home visit.");

  const { data: mine } = await db.from("booking_requests").select("id").eq("status", "new").eq("phone", phone!).gte("starts_at", new Date().toISOString()).limit(1);
  if (mine?.length) fail("You already have a request waiting. You'll hear back on WhatsApp soon.", false);
  const { count } = await db.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) fail("Online booking is busy right now. Please message the practice directly.", false);

  /* Check again: someone else may have taken the time since the page loaded */
  const start = new Date(startIso);
  const slot = (await openTimes(db, s, { minutes: service.minutes, location: where })).find((x) => x.start.getTime() === start.getTime());
  if (!slot) fail("Sorry, that time has just gone. Please pick another.", false);

  const { error } = await db.from("booking_requests").insert({
    full_name: name, phone, service: service.name, starts_at: slot!.start.toISOString(), ends_at: slot!.end.toISOString(),
    location: where, address: where === "home" ? address : "", note,
  });
  if (error) fail("Sorry, that didn't go through. Please try again, or message the practice directly.");
  redirect(`/${slug}?sent=${encodeURIComponent(slot!.start.toISOString())}#book`);
}
