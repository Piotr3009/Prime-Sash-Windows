-- ============================================================
-- PRIME SASH WINDOWS — Passport, Etap 3: project-level passports
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requires: db/window-passports.sql (Etap 1), db/window-passports-plate.sql (Etap 2)
-- ============================================================
--
-- STRUCTURE
--   passport_projects   one per job/address   PSW-2026-0031
--     └─ window_passports  one per physical window  PSW-2026-0031-W1  (+ its QR plate)
--
-- Documents (warranty certificate, PAS 24, etc.) are uploaded ONCE per project
-- and shown on every window's passport page.
--
-- Passports are created from PRODUCTION, not from estimates: an estimate is an
-- offer, a passport is a record of a window that physically exists.

create table if not exists public.passport_projects (
  id               uuid primary key default gen_random_uuid(),

  -- printed and shown to the client: PSW-2026-0031 (derived from the estimate
  -- number, so no counter and no race condition)
  passport_no      text not null unique,

  -- informational only, NO foreign key: deleting an estimate must never
  -- touch a passport of windows already installed in someone's house
  estimate_id      uuid,

  client_name      text,
  project_address  text,
  completed_date   date not null default current_date,

  -- warranty lives at project level and applies to every window below
  warranty_no      text,
  warranty_expiry  date,
  warranty_years   integer not null default 10,

  -- [{ "name": "PAS 24 certificate", "url": "...", "uploaded_at": "..." }]
  documents        jsonb not null default '[]'::jsonb,

  -- admin-only audit trail of corrections; never exposed publicly
  edit_history     jsonb not null default '[]'::jsonb,

  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists passport_projects_estimate_idx on public.passport_projects (estimate_id);
create index if not exists passport_projects_created_idx  on public.passport_projects (created_at desc);

-- Link windows to their project (plain uuid, consistent with the no-cascade rule)
alter table public.window_passports
  add column if not exists project_id uuid;

create index if not exists window_passports_project_idx on public.window_passports (project_id);

-- ------------------------------------------------------------
-- Public read. Warranty and documents now come from the project;
-- the window's own columns stay as a fallback for Etap 1/2 records.
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

-- ------------------------------------------------------------
-- RLS: nothing public directly; signed-in staff manage passports.
-- No DELETE policy - passports are permanent documents.
-- ------------------------------------------------------------
alter table public.passport_projects enable row level security;

drop policy if exists passport_projects_auth_select on public.passport_projects;
create policy passport_projects_auth_select on public.passport_projects
  for select to authenticated using (true);

drop policy if exists passport_projects_auth_insert on public.passport_projects;
create policy passport_projects_auth_insert on public.passport_projects
  for insert to authenticated with check (true);

drop policy if exists passport_projects_auth_update on public.passport_projects;
create policy passport_projects_auth_update on public.passport_projects
  for update to authenticated using (true) with check (true);
