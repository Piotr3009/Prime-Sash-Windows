-- ============================================================
-- PRIME SASH WINDOWS — Passport: per-window U-value
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requires db/passport-setup-all.sql to have been run first.
-- ============================================================
--
-- U-value is entered by hand, per window. It is NOT derived from the glazing
-- type: a real whole-window Uw depends on the frame-to-glass ratio, so it
-- differs between a small barred window and a large plain one in the same job.
-- Stored as text so the certificate's own wording can be kept exactly.

alter table public.window_passports
  add column if not exists u_value text;

-- ------------------------------------------------------------
-- Public read: same fields as before plus u_value.
-- ------------------------------------------------------------
create or replace function public.get_window_passport(p_token uuid)
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
    'u_value',           wp.u_value,
    'warranty_no',       coalesce(pp.warranty_no, wp.warranty_no),
    'warranty_expiry',   coalesce(pp.warranty_expiry, wp.warranty_expiry),
    'warranty_years',    coalesce(pp.warranty_years, wp.warranty_years),
    'specification',     wp.specification,
    'attachments',       case
                           when pp.documents is not null and jsonb_array_length(pp.documents) > 0
                             then pp.documents
                           else wp.attachments
                         end
  )
  from public.window_passports wp
  left join public.passport_projects pp on pp.id = wp.project_id
  where wp.token = p_token;
$$;

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
    'u_value',           wp.u_value,
    'warranty_no',       coalesce(pp.warranty_no, wp.warranty_no),
    'warranty_expiry',   coalesce(pp.warranty_expiry, wp.warranty_expiry),
    'warranty_years',    coalesce(pp.warranty_years, wp.warranty_years),
    'specification',     wp.specification,
    'attachments',       case
                           when pp.documents is not null and jsonb_array_length(pp.documents) > 0
                             then pp.documents
                           else wp.attachments
                         end
  )
  from public.window_passports wp
  left join public.passport_projects pp on pp.id = wp.project_id
  where wp.plate_code = p_code;
$$;

grant execute on function public.get_window_passport(uuid) to anon, authenticated;
grant execute on function public.get_window_passport_by_plate(text) to anon, authenticated;
