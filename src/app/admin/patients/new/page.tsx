import { Flash, type FlashParams } from "@/components/flash";
import { PatientForm } from "@/components/patient-form";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/server";

export default async function NewPatient({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const s = await getSettings(createAdminClient());
  return (
    <main className="stack">
      <h1>Add a patient</h1>
      <Flash {...flash} />
      <section className="card"><PatientForm clinicName={s.clinic_name || "Clinic"} /></section>
    </main>
  );
}
