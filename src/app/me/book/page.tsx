import Link from "next/link";
import { redirect } from "next/navigation";
import { bookSession, moveSession } from "@/app/me/actions";
import { Flash } from "@/components/flash";
import { Logo } from "@/components/logo";
import { requirePatient } from "@/lib/auth";
import { changeable, patientSlots } from "@/lib/booking";
import { APP_NAME } from "@/lib/brand";
import type { Location } from "@/lib/scheduler";
import { getSettings, practiceLabel } from "@/lib/settings";
import { formatDay, zone } from "@/lib/time";
import type { Visit } from "@/lib/types";

export const metadata = { title: "Book a session" };

/* Patients pick an open time to book a session, or to move one they already have */
export default async function Book({ searchParams }: { searchParams: Promise<{ practice?: string; visit?: string; where?: string; ok?: string; error?: string }> }) {
  const { practice, visit: visitId, where, ...flash } = await searchParams;
  const { patient, db } = await requirePatient(practice);
  const s = await getSettings(db);
  const home = `/me?practice=${patient.practice_id}`;
  if (!s.self_booking) redirect(home);
  const z = zone(s.time_zone);

  let moving: Visit | null = null;
  if (visitId) {
    const { data } = await db.from("visits").select("*").eq("id", visitId).eq("patient_id", patient.id).maybeSingle();
    moving = data as Visit | null;
    if (!moving || !changeable(moving, s)) redirect(`${home}&error=${encodeURIComponent("This session can't be moved online any more. Please message your physio.")}`);
  }
  const location: Location = moving?.location ?? (where === "home" || where === "clinic" ? where : patient.default_location);
  const slots = await patientSlots(db, s, patient, { location, moving: moving ?? undefined });
  const days = [...new Set(slots.map((x) => x.day))];
  const self = (w: Location) => `/me/book?practice=${patient.practice_id}&where=${w}`;

  return (
    <div className="shell">
      <header className="top">
        <div className="top-row">
          <Link href={home} className="brand"><Logo /><span>{APP_NAME}<small>{practiceLabel(s)}</small></span></Link>
          <Link href={home} className="btn sm">Back</Link>
        </div>
      </header>
      <main className="stack">
        <div>
          <h1>{moving ? "Move your session" : "Book a session"}</h1>
          <p className="muted">
            {moving
              ? `Currently ${formatDay(z.day(new Date(moving.starts_at)), true)} at ${z.time(new Date(moving.starts_at))}. Pick a new time.`
              : `${patient.session_minutes}-minute session. Times shown in ${z.tz.replace(/_/g, " ")} time.`}
          </p>
        </div>
        <Flash {...flash} />
        {!moving && (
          <nav className="row" aria-label="Where">
            <Link className={`chip ${location === "clinic" ? "clinic" : ""}`} href={self("clinic")}>At {s.clinic_name || "the clinic"}</Link>
            <Link className={`chip ${location === "home" ? "home" : ""}`} href={self("home")}>At home</Link>
          </nav>
        )}
        {days.length ? days.map((day) => (
          <section key={day} className="card">
            <h2 style={{ marginBottom: 10 }}>{formatDay(day, true)}</h2>
            <div className="row">
              {slots.filter((x) => x.day === day).map((x) => (
                <form key={x.start.toISOString()} action={moving ? moveSession : bookSession} className="inline">
                  <input type="hidden" name="practice" value={patient.practice_id} />
                  <input type="hidden" name="start" value={x.start.toISOString()} />
                  <input type="hidden" name="location" value={location} />
                  {moving && <input type="hidden" name="visit" value={moving.id} />}
                  <input type="hidden" name="back" value={`/me/book?practice=${patient.practice_id}${moving ? `&visit=${moving.id}` : ""}`} />
                  <button className="btn sm">{z.time(x.start)}</button>
                </form>
              ))}
            </div>
          </section>
        )) : (
          <p className="notice warn">No open times in the next {s.booking_window_days} days. Message your physio, or add the times that suit you so they can plan around them.</p>
        )}
      </main>
    </div>
  );
}
