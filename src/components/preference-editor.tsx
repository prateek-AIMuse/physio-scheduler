import { formatTime, parseTime, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/time";
import type { Preference } from "@/lib/types";

/* The list of times that suit a patient, with a form to add more. Used by the physio and by the patient. */
export function PreferenceEditor({ prefs, patientId, practiceId, back, add, remove, clinicName }: {
  prefs: Preference[]; patientId?: string; practiceId?: string; back: string; clinicName: string;
  add: (fd: FormData) => Promise<void>; remove: (fd: FormData) => Promise<void>;
}) {
  const sorted = [...prefs].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  return (
    <div className="stack-sm">
      {sorted.length ? (
        <ul className="list">
          {sorted.map((x) => (
            <li key={x.id} className="row between">
              <span><span className="strong">{WEEKDAYS[x.weekday - 1]}</span> {formatTime(parseTime(x.start_time))}–{formatTime(parseTime(x.end_time))}
                {x.location && <span className={`chip ${x.location}`} style={{ marginLeft: 8 }}>{x.location === "home" ? "Home" : clinicName}</span>}</span>
              <form action={remove} className="inline">
                <input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value={back} />
                {practiceId && <input type="hidden" name="practice" value={practiceId} />}
                <button className="btn sm danger">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No preferred times yet.</p>}
      <details>
        <summary>+ Add a preferred time</summary>
        <form action={add} className="stack-sm">
          {patientId && <input type="hidden" name="patient_id" value={patientId} />}
          {practiceId && <input type="hidden" name="practice" value={practiceId} />}
          <input type="hidden" name="back" value={back} />
          <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small muted" style={{ marginBottom: 4 }}>Days</legend>
            {WEEKDAYS_SHORT.map((d, i) => <label key={d} className="check"><input type="checkbox" name="weekday" value={i + 1} /> {d}</label>)}
          </fieldset>
          <div className="fields">
            <label>From<input type="time" name="start_time" step={900} required defaultValue="09:00" /></label>
            <label>Until<input type="time" name="end_time" step={900} required defaultValue="12:00" /></label>
            <label>Place<select name="location" defaultValue=""><option value="">Usual place</option><option value="clinic">{clinicName}</option><option value="home">Home</option></select></label>
            <button className="btn primary">Add</button>
          </div>
        </form>
      </details>
    </div>
  );
}
