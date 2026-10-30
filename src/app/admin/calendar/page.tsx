import Link from "next/link";
import { addVisit, approveWeek, clearSuggestions, suggestWeek } from "@/app/admin/actions";
import { Flash } from "@/components/flash";
import { VisitCard } from "@/components/visit-card";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import { addDays, formatDay, formatTime, isDay, istDay, istInstant, mondayOf, parseTime, weekdayOf } from "@/lib/time";
import type { Availability, Patient, Visit } from "@/lib/types";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; error?: string }> }) {
  const { week: w, ...flash } = await searchParams;
  const now = new Date();
  const today = istDay(now);
  const week = mondayOf(isDay(w) ? w : today);
  const back = `/admin/calendar?week=${week}`;
  const { db } = await requireAdmin();
  const [s, { data: patients }, { data: visits }, { data: avail }] = await Promise.all([
    getSettings(db),
    db.from("patients").select("*").order("full_name"),
    db.from("visits").select("*").gte("starts_at", istInstant(week, 0).toISOString()).lt("starts_at", istInstant(addDays(week, 7), 0).toISOString()).order("starts_at"),
    db.from("availability").select("*").order("start_time"),
  ]);
  const plist = (patients ?? []) as Patient[];
  const byId = new Map(plist.map((p) => [p.id, p]));
  const list = (visits ?? []) as Visit[];
  const proposed = list.filter((v) => v.status === "proposed").length;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const hidden = <><input type="hidden" name="week" value={week} /><input type="hidden" name="back" value={back} /></>;

  return (
    <main className="stack">
      <div className="row between">
        <h1>Week of {formatDay(week)}</h1>
        <div className="row">
          <Link className="btn sm" href={`/admin/calendar?week=${addDays(week, -7)}`} aria-label="Previous week">←</Link>
          <Link className="btn sm" href="/admin/calendar">This week</Link>
          <Link className="btn sm" href={`/admin/calendar?week=${addDays(week, 7)}`} aria-label="Next week">→</Link>
        </div>
      </div>
      <Flash {...flash} />

      <section className="card stack-sm">
        <h2>Plan this week</h2>
        <p className="small muted">
          Suggests visits for every active patient, matching your free slots with the times that suit them, with {s.travel_buffer_minutes} minutes&apos; travel around home visits.
          Nothing is booked until you approve.
        </p>
        <div className="row">
          <form action={suggestWeek} className="inline">{hidden}<button className="btn primary">Suggest visits</button></form>
          {proposed > 0 && <>
            <form action={approveWeek} className="inline">{hidden}<button className="btn primary">Approve all {proposed} suggestions</button></form>
            <form action={clearSuggestions} className="inline">{hidden}<button className="btn danger">Clear suggestions</button></form>
          </>}
        </div>
      </section>

      {days.map((day) => {
        const dayVisits = list.filter((v) => istDay(new Date(v.starts_at)) === day);
        const free = ((avail ?? []) as Availability[]).filter((a) => a.weekday === weekdayOf(day));
        return (
          <section key={day} className="card" id={day}>
            <div className="day-head">
              <h2>{formatDay(day, true)}{day === today && <span className="chip scheduled" style={{ marginLeft: 8 }}>Today</span>}</h2>
              <span className="free">{free.length ? `Free ${free.map((a) => `${formatTime(parseTime(a.start_time))}–${formatTime(parseTime(a.end_time))}`).join(", ")}` : "Not working"}</span>
            </div>
            {dayVisits.length ? <ul className="list">{dayVisits.map((v) => <li key={v.id}><VisitCard v={v} p={byId.get(v.patient_id)} s={s} back={`${back}#${day}`} now={now} /></li>)}</ul>
              : <p className="empty small">No visits.</p>}
          </section>
        );
      })}

      <section className="card">
        <h2>Book a visit</h2>
        <form action={addVisit} className="fields">
          <input type="hidden" name="back" value={back} />
          <label>Patient<select name="patient_id" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {plist.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select></label>
          <label>Date<input type="date" name="day" required defaultValue={week < today ? today : week} /></label>
          <label>Time<input type="time" name="time" step={900} required defaultValue="10:00" /></label>
          <label>Place<select name="location" defaultValue=""><option value="">Patient&apos;s usual</option><option value="clinic">{s.clinic_name || "Clinic"}</option><option value="home">Home</option></select></label>
          <label>Minutes<input type="number" name="minutes" min={15} max={180} step={15} placeholder="Patient's usual" /></label>
          <label className="check"><input type="checkbox" name="allow_clash" /> Book anyway if it clashes</label>
          <button className="btn primary">Book</button>
        </form>
      </section>
    </main>
  );
}
