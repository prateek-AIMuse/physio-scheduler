import { addStarterExercises, deleteExercise, saveExercise } from "@/app/admin/exercises/actions";
import { Flash, type FlashParams } from "@/components/flash";
import { requireAdmin } from "@/lib/auth";
import type { Exercise } from "@/lib/types";

export const metadata = { title: "Exercises" };

function ExerciseFields({ e }: { e?: Exercise }) {
  return (
    <>
      <div className="fields">
        <label>Name<input name="name" required defaultValue={e?.name} placeholder="e.g. Glute bridge" /></label>
        <label>Body area<input name="body_area" defaultValue={e?.body_area} placeholder="e.g. Lower back" /></label>
      </div>
      <label>How to do it<textarea name="instructions" rows={3} defaultValue={e?.instructions} /></label>
      <label>Video link (optional)<input name="video_url" type="url" defaultValue={e?.video_url} placeholder="https://youtube.com/…" /></label>
    </>
  );
}

/* The practice's exercise library, used to build each patient's home programme */
export default async function Exercises({ searchParams }: { searchParams: FlashParams }) {
  const flash = await searchParams;
  const { db } = await requireAdmin();
  const { data } = await db.from("exercises").select("*").order("body_area").order("name");
  const list = (data ?? []) as Exercise[];
  return (
    <main className="stack">
      <div className="row between">
        <div>
          <h1>Exercise library</h1>
          <p className="muted">Build home programmes from these on each patient&apos;s page. Patients see the instructions and video, and tick off each day.</p>
        </div>
        <form action={addStarterExercises}><button className="btn">Add starter exercises</button></form>
      </div>
      <Flash {...flash} />
      <section className="card">
        <h2>Add an exercise</h2>
        <form action={saveExercise} className="stack-sm">
          <ExerciseFields />
          <div><button className="btn primary">Add exercise</button></div>
        </form>
      </section>
      <section className="card">
        <h2>Your exercises <span className="muted small">({list.length})</span></h2>
        {list.length ? (
          <ul className="list">
            {list.map((e) => (
              <li key={e.id} className="stack-sm">
                <div className="row between">
                  <div>
                    <p className="strong">{e.name}</p>
                    <p className="small muted">{e.body_area}{e.video_url && " · has video"}</p>
                  </div>
                  <form action={deleteExercise} className="inline"><input type="hidden" name="id" value={e.id} /><button className="btn sm danger">Delete</button></form>
                </div>
                <details>
                  <summary>Edit</summary>
                  <form action={saveExercise} className="stack-sm">
                    <input type="hidden" name="id" value={e.id} />
                    <ExerciseFields e={e} />
                    <div><button className="btn primary sm">Save</button></div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="empty">No exercises yet. Add your own, or start with the starter set and adjust it.</p>}
      </section>
    </main>
  );
}
