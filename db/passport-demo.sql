-- ============================================================
-- PRIME SASH WINDOWS — Demo Window Passport for the public page
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requires db/window-passports.sql (Etap 1) to have been run.
-- ============================================================
--
-- window-passport.html links to /p/<token> and shows a scannable QR pointing
-- at the same URL, so visitors can experience a real passport. The token is
-- FIXED (not generated) because it is printed into the page and into the QR:
--   https://www.primesashwindows.co.uk/p/d0000000-0000-4000-8000-000000000001
--
-- The record is a plain Etap 1/2 passport (no project): warranty lives in the
-- window's own columns, which the public RPC still reads as a fallback.
-- No screenshots and no 3D config - the passport page hides those sections
-- cleanly when absent. Replace the specification below with a real window's
-- frozen spec later if you want the demo to carry a photo and 3D.

insert into public.window_passports
  (token, serial_number, window_number, window_type, project_label,
   manufactured_date, warranty_no, warranty_expiry, warranty_years,
   u_value, specification)
values
  ('d0000000-0000-4000-8000-000000000001',
   'PSW-DEMO-0001-W1',
   'W1',
   'Sash window',
   'Demo — Victorian terrace, London',
   '2026-05-14',
   'PSW-2026-DEMO1',
   '2036-05-14',
   10,
   '1.4',
   jsonb_build_object(
     'rows', jsonb_build_array(
       jsonb_build_object('label','Dimensions','value','900 × 1500 mm (brick to brick)'),
       jsonb_build_object('label','Frame','value','Standard box, 164 mm'),
       jsonb_build_object('label','Timber','value','Engineered hardwood'),
       jsonb_build_object('label','Glazing','value','Double glazed, 4-14-4, argon'),
       jsonb_build_object('label','Spacer','value','White'),
       jsonb_build_object('label','Glazing bars','value','2 over 2, 25 mm'),
       jsonb_build_object('label','Colour exterior','value','F&B All White 2005'),
       jsonb_build_object('label','Colour interior','value','F&B All White 2005'),
       jsonb_build_object('label','Ironmongery','value','Polished chrome, sash lock'),
       jsonb_build_object('label','Security','value','PAS 24 certified')
     )
   ))
on conflict (serial_number) do nothing;
