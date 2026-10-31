import { addAvailability, deleteAvailability } from "@/app/admin/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { requireAdmin } from "@/lib/auth";
import { formatTime, parseTime, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/time";
import type { Availability } from "@/lib/types";

export default async function Hours({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { data } = await (await requireAdmin()).db.from("availability").select("*").order("weekday").order("start_time");
  const slots = (data ?? []) as Availability[];
  return (
    <main className="stack">
      <div>
        <h1>Your free slots</h1>
        <p className="muted">The weekly times you can see patients. Visits are only suggested inside these.</p>
      </div>
      <Flash {...flash} />
      <section className="card">
        <ul className="list">
          {WEEKDAYS.map((name, i) => {
            const day = slots.filter((s) => s.weekday === i + 1);
            return (
              <li key={name} className="row between">
                <span className="strong" style={{ width: 110 }}>{name}</span>
                <div className="row grow">
                  {day.length ? day.map((s) => (
                    <form key={s.id} action={deleteAvailability} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn sm" title="Remove this slot">{formatTime(parseTime(s.start_time))}–{formatTime(parseTime(s.end_time))} ✕</button>
                    </form>
                  )) : <span className="muted small">Not working</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="card">
        <h2>Add a free slot</h2>
        <form action={addAvailability} className="stack-sm">
          <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted" style={{ marginBottom: 4 }}>Days</legend>
            {WEEKDAYS_SHORT.map((d, i) => <label key={d} className="check"><input type="checkbox" name="weekday" value={i + 1} defaultChecked={i < 6} /> {d}</label>)}
          </fieldset>
          <div className="fields">
            <label>From<input type="time" name="start_time" step={900} required defaultValue="07:00" /></label>
            <label>Until<input type="time" name="end_time" step={900} required defaultValue="12:00" /></label>
            <button className="btn primary">Add</button>
          </div>
        </form>
        <p className="small muted" style={{ marginTop: 8 }}>Add a morning and an evening slot separately to leave a break in between.</p>
      </section>
    </main>
  );
}
