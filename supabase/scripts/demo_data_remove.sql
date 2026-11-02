-- Removes the Movera demo data (the dummy patients with +91 00000 0000x numbers and everything
-- attached to them) from sharmaprateekd@gmail.com's practice. Real patients are never touched.
delete from public.patients
where phone like '9100000000%'
  and practice_id = (select p.id from public.practices p join auth.users u on u.id = p.owner_user_id where lower(u.email) = 'sharmaprateekd@gmail.com');
select count(*) as demo_patients_left from public.patients where phone like '9100000000%';
