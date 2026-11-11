import { acceptBooking, declineBooking } from "@/app/admin/website/actions";
import { formatPhone } from "@/lib/format";
import type { BookingRequest } from "@/lib/practice-page";
import { formatDay, type Zone } from "@/lib/time";
import { waLink } from "@/lib/whatsapp";

/* Times new patients asked for on the practice's page, waiting for the physio's answer */
export function BookingRequests({ requests, z }: { requests: BookingRequest[]; z: Zone }) {
  if (!requests.length) return null;
  return (
    <section className="card">
      <h2>Booking requests from your page</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>Each request holds its time until you answer. Accepting books the visit and adds a new person to your patients.</p>
      <ul className="list">
        {requests.map((r) => {
          const start = new Date(r.starts_at);
          const minutes = Math.round((Date.parse(r.ends_at) - start.getTime()) / 60_000);
          return (
            <li key={r.id} className="stack-sm">
              <div className="row between">
                <span><span className="strong">{r.full_name}</span> <span className="small muted">{formatPhone(r.phone)}</span></span>
                <span className={`chip ${r.location}`}>{r.location === "home" ? "Home" : "Clinic"}</span>
              </div>
              <p>{formatDay(z.day(start), true)} at {z.time(start)} · {minutes} min{r.service ? ` · ${r.service}` : ""}</p>
              {r.address && <p className="small muted">{r.address}</p>}
              {r.note && <p className="msg-body">{r.note}</p>}
              <div className="row">
                <form action={acceptBooking} className="inline"><input type="hidden" name="id" value={r.id} /><button className="btn sm primary">Accept and book</button></form>
                <a className="btn sm wa" href={waLink(r.phone, `Hi ${r.full_name.split(/\s+/)[0]}, thanks for your booking request.`)} target="_blank" rel="noopener noreferrer">Message</a>
                <form action={declineBooking} className="inline"><input type="hidden" name="id" value={r.id} /><button className="btn sm danger">Decline</button></form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
