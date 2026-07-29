-- ============================================================
-- PRIME SASH WINDOWS — Window Passport, Etap 2: QR plates
-- Run this whole file once in Supabase → SQL Editor.
-- Safe to re-run. Requires db/window-passports.sql (Etap 1) to be run first.
-- ============================================================
--
-- The metal plates are bought pre-engraved with codes we did NOT choose.
-- A passport is created first, then a plate is scanned and linked to it.
-- The plate code is stored verbatim, so any supplier numbering works
-- (e.g. "123455666.44555"), and the plate that carries
-- https://primesashwindows.co.uk/q/<code> resolves to that passport.

alter table public.window_passports
  add column if not exists plate_code   text,
  add column if not exists plate_linked_at timestamptz;

-- One plate can never end up on two windows. Partial index so the many
-- passports still without a plate don't collide on NULL.
create unique index if not exists window_passports_plate_uidx
  on public.window_passports (plate_code)
  where plate_code is not null;

-- ------------------------------------------------------------
-- Public read by plate code — same SECURITY DEFINER pattern as
-- get_window_passport, returning exactly the same public fields.
-- ------------------------------------------------------------
create or replace function public.get_window_passport_by_plate(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'serial_number',     wp.serial_number,
    'window_number',     wp.window_number,
    'window_type',       wp.window_type,
    'project_label',     wp.project_label,
    'manufactured_date', wp.manufactured_date,
    'warranty_no',       wp.warranty_no,
    'warranty_expiry',   wp.warranty_expiry,
    'warranty_years',    wp.warranty_years,
    'specification',     wp.specification,
    'attachments',       wp.attachments
  )
  from public.window_passports wp
  where wp.plate_code = p_code;
$$;

grant execute on function public.get_window_passport_by_plate(text) to anon, authenticated;

-- Optional: give the Etap 1 test record a plate so /q/TEST-PLATE-001 works too.
update public.window_passports
   set plate_code = 'TEST-PLATE-001',
       plate_linked_at = now()
 where serial_number = 'PSW-2026-0042-W1'
   and plate_code is null;
