import { completeVisit, reopenVisit, setVisitStatus, updateVisit } from "@/app/admin/actions";
import { mapsLink } from "@/lib/format";
import { toTime, zone } from "@/lib/time";
import { LOCATION_LABEL, STATUS_LABEL, type Patient, type Settings, type Visit } from "@/lib/types";

function Btn({ id, back, action, label, status, cls = "" }: { id: string; back: string; action: (fd: FormData) => Promise<void>; label: string; status?: string; cls?: string }) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      {status && <input type="hidden" name="status" value={status} />}
      <button className={`btn sm ${cls}`}>{label}</button>
    </form>
  );
}

/* One visit with the buttons the physio needs for it. `back` is the page to return to after an action. */
export function VisitCard({ v, p, s, back, now }: { v: Visit; p: Patient | undefined; s: Settings; back: string; now: Date }) {
  const start = new Date(v.starts_at), end = new Date(v.ends_at);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const map = v.location === "home" ? mapsLink(p?.address ?? "", p?.maps_url ?? "") : s.clinic_maps_url;
  const started = start <= now;
  const z = zone(s.time_zone);
  return (
    <div className="visit">
      <div className="time">{z.time(start)}<small>{minutes} min</small></div>
      <div className="stack-sm">
        <div className="row">
          <a href={`/admin/patients/${v.patient_id}`} className="strong">{p?.full_name ?? "Unknown patient"}</a>
          <span className={`chip ${v.location}`}>{LOCATION_LABEL[v.location]}</span>
          {v.status !== "scheduled" && <span className={`chip ${v.status}`}>{STATUS_LABEL[v.status]}</span>}
          {v.visit_no && <span className="chip">Visit {v.visit_no}</span>}
        </div>
        {v.location === "home" && p?.address && <p className="small muted">{p.address}</p>}
        <div className="row">
          {map && <a className="btn sm" href={map} target="_blank" rel="noreferrer">Map</a>}
          {v.status === "proposed" && <><Btn id={v.id} back={back} action={setVisitStatus} status="scheduled" label="Approve" cls="primary" /><Btn id={v.id} back={back} action={setVisitStatus} status="cancelled" label="Remove" cls="danger" /></>}
          {v.status === "scheduled" && <>
            <Btn id={v.id} back={back} action={completeVisit} label="Done" cls={started ? "primary" : ""} />
            {started && <Btn id={v.id} back={back} action={setVisitStatus} status="no_show" label="No-show" />}
            <Btn id={v.id} back={back} action={setVisitStatus} status="cancelled" label="Cancel" cls="danger" />
          </>}
          {(v.status === "cancelled" || v.status === "no_show") && <Btn id={v.id} back={back} action={setVisitStatus} status="scheduled" label="Restore" />}
          {v.status === "completed" && <Btn id={v.id} back={back} action={reopenVisit} label="Undo done" />}
        </div>
        {(v.status === "proposed" || v.status === "scheduled") && (
          <details>
            <summary>Change time or place</summary>
            <form action={updateVisit} className="fields">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="back" value={back} />
              <label>Date<input type="date" name="day" defaultValue={z.day(start)} required /></label>
              <label>Time<input type="time" name="time" step={900} defaultValue={toTime(z.minutes(start))} required /></label>
              <label>Minutes<input type="number" name="minutes" min={15} max={180} step={15} defaultValue={minutes} /></label>
              <label>Place<select name="location" defaultValue={v.location}><option value="clinic">Clinic</option><option value="home">Home</option></select></label>
              <label className="check"><input type="checkbox" name="allow_clash" /> Book anyway if it clashes</label>
              <button className="btn primary">Save</button>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
