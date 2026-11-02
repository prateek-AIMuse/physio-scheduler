-- Movera demo data: a "Movera Demo Clinic" practice for sharmaprateekd@gmail.com with six dummy
-- patients that exercise every feature (packages and the visit counter, renewals and payment
-- requests, home visits, no-shows and cancellations, suggested visits, patient self-booking,
-- exercise programmes, preferred times, conditions).
--
-- Phone numbers are +91 00000 0000x: not real numbers, so nothing can reach a real person.
-- Run once in Supabase → SQL Editor, after all migrations (0001–0007).
-- To remove it later, run demo_data_remove.sql.
do $$
declare
  me uuid;
  pr uuid;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  pid uuid; pkg uuid; v uuid; ex record; pe uuid;
  i int;
begin
  select id into me from auth.users where lower(email) = 'sharmaprateekd@gmail.com';
  if me is null then raise exception 'No account for sharmaprateekd@gmail.com.'; end if;

  select id into pr from public.practices where owner_user_id = me;
  if pr is not null and exists (select 1 from public.patients where practice_id = pr and phone not like '9100000000%') then
    raise exception 'sharmaprateekd@gmail.com still owns a practice with real patients. Run move_practice_to_harsh.sql first, so the demo data stays separate. Nothing was changed.';
  end if;
  if pr is not null and exists (select 1 from public.patients where practice_id = pr and phone like '9100000000%') then
    raise exception 'The demo data is already there. To start again, run demo_data_remove.sql first.';
  end if;

  if pr is null then
    insert into public.practices (owner_user_id, status, physio_name, email, city, approved_at)
    values (me, 'approved', 'Dr Demo Physio', 'sharmaprateekd@gmail.com', 'Mumbai', now()) returning id into pr;
    insert into public.settings (practice_id) values (pr);
  end if;
  update public.practices set status = 'approved', approved_at = coalesce(approved_at, now()), physio_name = 'Dr Demo Physio' where id = pr;
  update public.settings set
    practice_name = 'Movera Demo Clinic', physio_name = 'Dr Demo Physio', clinic_name = 'Movera Demo Clinic',
    clinic_maps_url = '', upi_id = 'demo@upi', upi_payee_name = 'DEMO - do not pay',
    home_visit_fee = 300, travel_buffer_minutes = 30, time_zone = 'Asia/Kolkata', currency = 'INR', country_code = '91',
    self_booking = true, booking_notice_hours = 12, booking_window_days = 14
  where practice_id = pr;

  -- Free slots: Monday to Saturday, mornings and evenings
  delete from public.availability where practice_id = pr;
  insert into public.availability (practice_id, weekday, start_time, end_time)
  select pr, d, t.s, t.e from generate_series(1, 6) d, (values (time '07:00', time '12:00'), (time '16:00', time '20:00')) t(s, e);

  -- Exercise library
  insert into public.exercises (practice_id, name, body_area, instructions)
  select pr, x.n, x.a, x.i from (values
    ('Quad sets', 'Knee', 'Sit or lie with your leg straight. Tighten the front of your thigh, pressing the back of the knee down. Hold, then relax.'),
    ('Straight leg raise', 'Knee and hip', 'Lie on your back, one knee bent. Tighten the straight leg and lift it to the height of the bent knee. Lower slowly.'),
    ('Sit to stand', 'Legs', 'From a firm chair, stand up without using your hands if you can. Sit back down slowly.'),
    ('Pendulum swings', 'Shoulder', 'Lean on a table with your good hand and let the other arm hang. Swing it gently in small circles.'),
    ('Wall slides', 'Shoulder', 'Back to a wall, elbows and wrists against it. Slide your arms up as far as is comfortable, then down.'),
    ('Glute bridge', 'Hips and lower back', 'Lie on your back, knees bent. Squeeze your buttocks and lift your hips, then lower slowly.'),
    ('Cat–camel', 'Lower back', 'On hands and knees, round your back up, then let it sag gently. Stay within a comfortable range.'),
    ('Wrist extensor stretch', 'Elbow and forearm', 'Arm straight, palm down. Gently bend the wrist down with the other hand until you feel a stretch. Hold.')
  ) x(n, a, i)
  where not exists (select 1 from public.exercises e where e.practice_id = pr and e.name = x.n);

  -- 1. Asha: knee OA, clinic, package 3 of 6 used, exercise programme with ticks
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, notes)
  values (pr, 'Asha Rao (demo)', '910000000001', 'Knee osteoarthritis', 45, 2, 'clinic', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 1, '07:00', '10:00'), (pid, 3, '07:00', '10:00'), (pid, 5, '07:00', '10:00');
  insert into public.packages (patient_id, total_visits, price, paid_at, created_at) values (pid, 6, 7200, now() - interval '20 days', now() - interval '20 days');
  for i in 1..3 loop
    insert into public.visits (patient_id, starts_at, ends_at, location) values (pid, ((today - (16 - i * 4)) + time '08:00') at time zone 'Asia/Kolkata', ((today - (16 - i * 4)) + time '08:45') at time zone 'Asia/Kolkata', 'clinic') returning id into v;
    perform public.complete_visit(v, 300);
  end loop;
  insert into public.visits (patient_id, starts_at, ends_at, location) values
    (pid, ((today + 2) + time '08:00') at time zone 'Asia/Kolkata', ((today + 2) + time '08:45') at time zone 'Asia/Kolkata', 'clinic'),
    (pid, ((today + 5) + time '08:00') at time zone 'Asia/Kolkata', ((today + 5) + time '08:45') at time zone 'Asia/Kolkata', 'clinic');
  for ex in select id, name from public.exercises where practice_id = pr and name in ('Quad sets', 'Straight leg raise', 'Sit to stand') loop
    insert into public.patient_exercises (patient_id, exercise_id, sets, reps, hold_seconds, notes)
    values (pid, ex.id, 3, case when ex.name = 'Sit to stand' then 8 else 12 end, case when ex.name = 'Quad sets' then 5 end, case when ex.name = 'Sit to stand' then 'Use the armrests if your knee is sore' else '' end)
    returning id into pe;
    insert into public.exercise_logs (patient_id, patient_exercise_id, day) select pid, pe, today - d from generate_series(1, 6) d where d % 2 = 1 or ex.name = 'Quad sets';
  end loop;

  -- 2. Vikram: ACL rehab, home visits, used up a 4-visit package -> renewal and payment request
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, address, notes)
  values (pr, 'Vikram Mehta (demo)', '910000000002', 'ACL reconstruction rehab', 60, 3, 'home', '12 Sea View, Bandra West, Mumbai', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 2, '17:00', '20:00'), (pid, 4, '17:00', '20:00'), (pid, 6, '09:00', '12:00');
  insert into public.packages (patient_id, total_visits, price, paid_at, created_at) values (pid, 4, 6000, now() - interval '14 days', now() - interval '14 days');
  for i in 1..4 loop
    insert into public.visits (patient_id, starts_at, ends_at, location) values (pid, ((today - (13 - i * 3)) + time '17:30') at time zone 'Asia/Kolkata', ((today - (13 - i * 3)) + time '18:30') at time zone 'Asia/Kolkata', 'home') returning id into v;
    perform public.complete_visit(v, 300);
  end loop;
  insert into public.visits (patient_id, starts_at, ends_at, location) values
    (pid, ((today + 1) + time '17:30') at time zone 'Asia/Kolkata', ((today + 1) + time '18:30') at time zone 'Asia/Kolkata', 'home');

  -- 3. Neha: frozen shoulder, unpaid package with a payment request, one no-show and one cancellation
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, notes)
  values (pr, 'Neha Joshi (demo)', '910000000003', 'Frozen shoulder', 60, 2, 'clinic', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 1, '16:00', '19:00'), (pid, 4, '16:00', '19:00');
  insert into public.packages (patient_id, total_visits, price, created_at) values (pid, 8, 9600, now() - interval '9 days') returning id into pkg;
  insert into public.payment_requests (patient_id, package_id, amount, description) values (pid, pkg, 9600, 'Package: 8 visits');
  insert into public.visits (patient_id, starts_at, ends_at, location) values (pid, ((today - 7) + time '16:00') at time zone 'Asia/Kolkata', ((today - 7) + time '17:00') at time zone 'Asia/Kolkata', 'clinic') returning id into v;
  perform public.complete_visit(v, 300);
  insert into public.visits (patient_id, starts_at, ends_at, location, status) values
    (pid, ((today - 4) + time '16:00') at time zone 'Asia/Kolkata', ((today - 4) + time '17:00') at time zone 'Asia/Kolkata', 'clinic', 'no_show'),
    (pid, ((today - 3) + time '16:00') at time zone 'Asia/Kolkata', ((today - 3) + time '17:00') at time zone 'Asia/Kolkata', 'clinic', 'cancelled'),
    (pid, ((today + 3) + time '16:00') at time zone 'Asia/Kolkata', ((today + 3) + time '17:00') at time zone 'Asia/Kolkata', 'clinic', 'scheduled');
  for ex in select id from public.exercises where practice_id = pr and name in ('Pendulum swings', 'Wall slides') loop
    insert into public.patient_exercises (patient_id, exercise_id, sets, reps, times_per_day, notes) values (pid, ex.id, 2, 10, 2, 'Stop if pain goes above 4/10');
  end loop;

  -- 4. Rahul: low back pain, no package yet, booked a session himself
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, notes)
  values (pr, 'Rahul Iyer (demo)', '910000000004', 'Low back pain', 45, 2, 'clinic', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 2, '07:00', '09:00'), (pid, 5, '18:00', '20:00');
  insert into public.visits (patient_id, starts_at, ends_at, location, booked_by, changed_at) values
    (pid, ((today + 4) + time '18:30') at time zone 'Asia/Kolkata', ((today + 4) + time '19:15') at time zone 'Asia/Kolkata', 'clinic', 'patient', now() - interval '2 hours');
  for ex in select id from public.exercises where practice_id = pr and name in ('Glute bridge', 'Cat–camel') loop
    insert into public.patient_exercises (patient_id, exercise_id, sets, reps) values (pid, ex.id, 3, 10);
  end loop;

  -- 5. Meera: stroke rehab at home, big package, suggested visits waiting for approval next week
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, address, notes)
  values (pr, 'Meera Kapoor (demo)', '910000000005', 'Stroke rehab', 60, 3, 'home', 'Flat 4B, Sunrise Towers, Andheri East, Mumbai', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 1, '10:00', '12:00'), (pid, 3, '10:00', '12:00'), (pid, 5, '10:00', '12:00');
  insert into public.packages (patient_id, total_visits, price, paid_at, created_at) values (pid, 10, 15000, now() - interval '10 days', now() - interval '10 days');
  for i in 1..2 loop
    insert into public.visits (patient_id, starts_at, ends_at, location) values (pid, ((today - (8 - i * 3)) + time '10:30') at time zone 'Asia/Kolkata', ((today - (8 - i * 3)) + time '11:30') at time zone 'Asia/Kolkata', 'home') returning id into v;
    perform public.complete_visit(v, 300);
  end loop;
  insert into public.visits (patient_id, starts_at, ends_at, location, status)
  select pid, ((today + d) + time '10:30') at time zone 'Asia/Kolkata', ((today + d) + time '11:30') at time zone 'Asia/Kolkata', 'home', 'proposed'
  from (select (8 - extract(isodow from today)::int) + o as d from (values (0), (2), (4)) x(o)) w;

  -- 6. Arjun: tennis elbow, session tomorrow (shows a day-before reminder)
  insert into public.patients (practice_id, full_name, phone, condition, session_minutes, visits_per_week, default_location, notes)
  values (pr, 'Arjun Singh (demo)', '910000000006', 'Tennis elbow', 45, 1, 'clinic', 'Demo patient') returning id into pid;
  insert into public.preferences (patient_id, weekday, start_time, end_time) values (pid, 6, '07:00', '11:00');
  insert into public.packages (patient_id, total_visits, price, paid_at, created_at) values (pid, 4, 4000, now() - interval '8 days', now() - interval '8 days');
  insert into public.visits (patient_id, starts_at, ends_at, location) values (pid, ((today - 6) + time '07:30') at time zone 'Asia/Kolkata', ((today - 6) + time '08:15') at time zone 'Asia/Kolkata', 'clinic') returning id into v;
  perform public.complete_visit(v, 300);
  insert into public.visits (patient_id, starts_at, ends_at, location) values
    (pid, ((today + 1) + time '07:30') at time zone 'Asia/Kolkata', ((today + 1) + time '08:15') at time zone 'Asia/Kolkata', 'clinic');
  for ex in select id from public.exercises where practice_id = pr and name = 'Wrist extensor stretch' loop
    insert into public.patient_exercises (patient_id, exercise_id, sets, reps, hold_seconds) values (pid, ex.id, 3, 5, 30);
  end loop;

  raise notice 'Demo data added to Movera Demo Clinic';
end $$;

-- What was added
select s.practice_name, count(distinct pt.id) as patients, count(v.id) filter (where v.status = 'completed') as completed_visits,
       count(v.id) filter (where v.status = 'scheduled') as upcoming, count(v.id) filter (where v.status = 'proposed') as suggested,
       (select count(*) from public.payment_requests r where r.practice_id = s.practice_id and r.status = 'pending') as payments_waiting
from public.settings s join public.practices p on p.id = s.practice_id join auth.users u on u.id = p.owner_user_id
left join public.patients pt on pt.practice_id = s.practice_id left join public.visits v on v.patient_id = pt.id
where lower(u.email) = 'sharmaprateekd@gmail.com' group by s.practice_name, s.practice_id;
