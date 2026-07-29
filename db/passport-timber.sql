-- ============================================================
-- PRIME SASH WINDOWS — Passport: timber species
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requires db/passport-setup-all.sql and db/passport-uvalue.sql.
-- ============================================================
--
-- Timber is set per PROJECT, not per window: one job is made from one material,
-- and nobody wants to pick the same species eleven times. The configurator does
-- not capture species at all, so this is the only place it is recorded.

alter table public.passport_projects
  add column if not exists timber text;

-- ------------------------------------------------------------
-- Public read: previous fields plus timber.
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
    'timber',            pp.timber,
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
    'timber',            pp.timber,
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
