import type { Location } from "@/lib/scheduler";

export type { Location };
export type VisitStatus = "proposed" | "scheduled" | "completed" | "cancelled" | "no_show";
export type MessageKind = "weekly_summary" | "day_reminder" | "payment_request" | "login_link" | "custom";

export type Settings = {
  practice_name: string;
  physio_name: string;
  clinic_name: string;
  clinic_maps_url: string;
  upi_id: string;
  upi_payee_name: string;
  home_visit_fee: number;
  travel_buffer_minutes: number;
  whatsapp_mode: "manual" | "cloud_api";
};

export type Patient = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  address: string;
  maps_url: string;
  session_minutes: number;
  visits_per_week: number;
  default_location: Location;
  notes: string;
  active: boolean;
  created_at: string;
};

export type Availability = { id: string; weekday: number; start_time: string; end_time: string };
export type Preference = { id: string; patient_id: string; weekday: number; start_time: string; end_time: string; location: Location | null };

export type Package = {
  id: string;
  patient_id: string;
  total_visits: number;
  price: number;
  paid_at: string | null;
  notes: string;
  auto_from_visit: string | null;
  created_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  starts_at: string;
  ends_at: string;
  location: Location;
  status: VisitStatus;
  package_id: string | null;
  visit_no: number | null;
  home_fee: number;
  completed_at: string | null;
};

export type PaymentRequest = {
  id: string;
  token: string;
  patient_id: string;
  package_id: string | null;
  amount: number;
  description: string;
  status: "pending" | "paid" | "cancelled";
  from_visit: string | null;
  created_at: string;
  paid_at: string | null;
};

export type Message = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  kind: MessageKind;
  dedupe_key: string | null;
  body: string;
  template_params: string[];
  due_at: string;
  status: "pending" | "sent" | "skipped" | "failed";
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

export const LOCATION_LABEL: Record<Location, string> = { clinic: "Clinic", home: "Home" };
export const STATUS_LABEL: Record<VisitStatus, string> = {
  proposed: "Suggested", scheduled: "Booked", completed: "Done", cancelled: "Cancelled", no_show: "No-show",
};
