-- Zero2Gig database (applied to the "Skillroute" Supabase project)
-- Tables: profiles (name, email) and progress (points, classes done, answers).
-- Row Level Security: each learner can only read and change their own rows.
-- A trigger creates a profile automatically on sign-up.
-- See the "SkillRoute Learners" notebook in Supabase to view all learners.


-- ---------------------------------------------------------------------------
-- Base table privileges for logged-in learners (added 25 Nov 2026).
-- Without these, Row Level Security policies alone are not enough: every save is rejected.
-- The policies above still keep each learner limited to their own rows.
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.progress to authenticated;
grant select on table public.profiles to authenticated;
grant update (reminders_on) on table public.profiles to authenticated;
grant select, insert on table public.activity to authenticated;
