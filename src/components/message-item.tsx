import { retryMessage, skipMessage } from "@/app/admin/actions";
import { SendButton } from "@/components/send-button";
import { formatPhone } from "@/lib/format";
import { formatDay, formatInstantTime, istDay } from "@/lib/time";
import type { Message, MessageKind, Patient } from "@/lib/types";

export const KIND_LABEL: Record<MessageKind, string> = {
  day_reminder: "Day-before reminder", weekly_summary: "Weekly schedule", payment_request: "Payment request", login_link: "Login link", custom: "Message",
};

const at = (iso: string) => `${formatDay(istDay(new Date(iso)))}, ${formatInstantTime(new Date(iso))}`;

export function MessageItem({ m, p, manual, back, now }: { m: Message; p: Patient | undefined; manual: boolean; back: string; now: Date }) {
  const due = Date.parse(m.due_at) <= now.getTime();
  return (
    <div className="stack-sm">
      <div className="row between">
        <div className="row">
          <span className="strong">{p?.full_name ?? "Unknown"}</span>
          <span className="chip">{KIND_LABEL[m.kind]}</span>
          {m.status !== "pending" && <span className={`chip ${m.status}`}>{m.status}</span>}
        </div>
        <span className="small muted">
          {m.status === "sent" && m.sent_at ? `Sent ${at(m.sent_at)}` : m.status === "pending" && !due ? `Due ${at(m.due_at)}` : p ? formatPhone(p.phone) : ""}
        </span>
      </div>
      <p className="msg-body">{m.body}</p>
      {m.error && m.status !== "sent" && <p className="small muted">{m.error}</p>}
      {(m.status === "pending" || m.status === "failed") && (
        <div className="row">
          {(manual || m.status === "failed") && <SendButton id={m.id} />}
          {m.status === "failed" && <form action={retryMessage} className="inline"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} /><button className="btn sm">Try again</button></form>}
          <form action={skipMessage} className="inline"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} /><button className="btn sm">Skip</button></form>
        </div>
      )}
    </div>
  );
}
