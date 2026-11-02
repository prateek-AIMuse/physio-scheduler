import { savePatient } from "@/app/admin/actions";
import type { Patient } from "@/lib/types";

/* Suggestions as the physio types; any condition can be entered */
const COMMON_CONDITIONS = [
  "Low back pain", "Neck pain", "Sciatica", "Lumbar disc herniation", "Cervical spondylosis", "Frozen shoulder",
  "Rotator cuff injury", "Tennis elbow", "Knee osteoarthritis", "ACL reconstruction rehab", "Meniscus injury",
  "Total knee replacement rehab", "Hip replacement rehab", "Ankle sprain", "Plantar fasciitis", "Post-fracture rehab",
  "Stroke rehab", "Parkinson's disease", "Sports injury", "Post-surgery rehab", "Posture correction",
];

export function PatientForm({ p, clinicName }: { p?: Patient; clinicName: string }) {
  return (
    <form action={savePatient} className="stack-sm">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="back" value={p ? `/admin/patients/${p.id}` : "/admin/patients/new"} />
      <div className="fields">
        <label>Name<input name="full_name" required defaultValue={p?.full_name} autoComplete="off" /></label>
        <label>WhatsApp number<input name="phone" type="tel" required placeholder="98765 43210" defaultValue={p ? `+${p.phone}` : ""} /></label>
        <label>Session length<select name="session_minutes" defaultValue={p?.session_minutes ?? 60}>
          {[30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select></label>
        <label>Visits a week<input name="visits_per_week" type="number" min={0} max={7} required defaultValue={p?.visits_per_week ?? 2} /></label>
        <label>Usual place<select name="default_location" defaultValue={p?.default_location ?? "clinic"}>
          <option value="clinic">{clinicName}</option><option value="home">Patient&apos;s home</option>
        </select></label>
      </div>
      <label>Condition being treated<input name="condition" required list="conditions" defaultValue={p?.condition} placeholder="e.g. Knee osteoarthritis, frozen shoulder, ACL rehab" autoComplete="off" /></label>
      <datalist id="conditions">{COMMON_CONDITIONS.map((c) => <option key={c} value={c} />)}</datalist>
      <label>Home address<textarea name="address" rows={2} defaultValue={p?.address} placeholder="Flat, building, street, area" /></label>
      <label>Google Maps link for the home (optional)<input name="maps_url" type="url" defaultValue={p?.maps_url} placeholder="https://maps.app.goo.gl/…  (without one, the address is searched)" /></label>
      <label>Notes (only you see these)<textarea name="notes" rows={2} defaultValue={p?.notes} /></label>
      <div><button className="btn primary">{p ? "Save" : "Add patient"}</button></div>
    </form>
  );
}
