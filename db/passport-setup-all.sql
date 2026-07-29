-- ============================================================
-- PRIME SASH WINDOWS — Window Passport: COMPLETE SETUP
-- ============================================================
-- Run this ONE file in Supabase → SQL Editor. Nothing else is needed.
-- It replaces db/window-passports.sql, db/window-passports-plate.sql and
-- db/passport-projects.sql, in the correct order.
--
-- Safe to run on a database where some of those were already applied:
-- every statement is IF NOT EXISTS / OR REPLACE, so nothing is lost and
-- existing passports are untouched.
--
-- WHY ONE FILE: the SQL Editor runs a script as a single transaction. If any
-- statement fails, EVERYTHING rolls back - which is why running the Etap 3
-- script before the Etap 2 one silently created nothing.
--
-- STRUCTURE
--   passport_projects   one per job/address       PSW-2026-0031
--     └─ window_passports  one per physical window  PSW-2026-0031-W1  (+ QR plate)
--
-- KEY RULE: a passport is a FROZEN COPY, never a live reference to an estimate.
-- Estimates get edited and deleted; a plate on a window in a client's house
-- must not start lying or break. Hence no foreign keys to estimates.
-- ============================================================

-- ─── 1. Windows ────────────────────────────────────────────

create table if not exists public.window_passports (
  id                uuid primary key default gen_random_uuid(),

  -- public door: /p/<token>. Random, unguessable, never changes (even when
  -- the passport is corrected) so printed stickers stay valid forever.
  token             uuid not null unique default gen_random_uuid(),

  -- human-readable, printed on the sticker: PSW-2026-0042-W1
  -- Built at creation from estimate number + window number (both already
  -- exist, so no counter and no race condition).
  serial_number     text not null unique,

  -- Informational only. NO foreign key on purpose - see design rule above.
  estimate_id       uuid,
  estimate_item_id  uuid,

  window_number     text,
  window_type       text,

  -- Frozen copy. Shape:
  --   { "rows": [{"label":"Dimensions","value":"896 x 1413 mm"}, ...],
  --     "screenshots": {"interior":"data:image/png;base64,...", "exterior":"..."},
  --     "viewer3d": { ...engine config... } }
  -- rows are produced by the SAME renderer the estimate uses, so the passport
  -- prints them 1:1 with zero translation on read.
  specification     jsonb not null default '{}'::jsonb,

  -- working location, NOT the full postal address: "Elm Street, ground floor, front"
  project_label     text,

  manufactured_date date not null default current_date,

  -- normally filled at creation; nullable so a passport can still be created
  -- when a project is produced in batches and the certificate comes later.
  warranty_no       text,
  warranty_expiry   date,
  warranty_years    integer not null default 10,

  -- frozen per-window documents: [{"name":"PAS 24 certificate","url":"..."}]
  attachments       jsonb not null default '[]'::jsonb,

  -- admin-only audit trail of corrections; never exposed by the public RPC
  edit_history      jsonb not null default '[]'::jsonb,

  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists window_passports_token_idx    on public.window_passports (token);
create index if not exists window_passports_estimate_idx on public.window_passports (estimate_id);
create index if not exists window_passports_created_idx  on public.window_passports (created_at desc);

-- ------------------------------------------------------------
-- Public read: SECURITY DEFINER RPC, same proven pattern as
-- get_shared_estimate. Table RLS stays locked; the token is the only door.
-- Deliberately omits edit_history, created_by and the estimate ids.
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
    'warranty_no',       wp.warranty_no,
    'warranty_expiry',   wp.warranty_expiry,
    'warranty_years',    wp.warranty_years,
    'specification',     wp.specification,
    'attachments',       wp.attachments
  )
  from public.window_passports wp
  where wp.token = p_token;
$$;

grant execute on function public.get_window_passport(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- RLS: anon gets nothing directly (only through the RPC above).
-- Signed-in staff manage passports from the admin panel.
-- ------------------------------------------------------------
alter table public.window_passports enable row level security;

drop policy if exists window_passports_auth_select on public.window_passports;
create policy window_passports_auth_select on public.window_passports
  for select to authenticated using (true);

drop policy if exists window_passports_auth_insert on public.window_passports;
create policy window_passports_auth_insert on public.window_passports
  for insert to authenticated with check (true);

drop policy if exists window_passports_auth_update on public.window_passports;
create policy window_passports_auth_update on public.window_passports
  for update to authenticated using (true) with check (true);

-- No DELETE policy on purpose: passports are permanent documents.

-- ------------------------------------------------------------
-- TEST RECORD (Etap 1) — lets you open the page before the admin
-- button exists. Delete it once real passports are created:
--   delete from public.window_passports where serial_number = 'PSW-2026-0042-W1';
-- ------------------------------------------------------------
insert into public.window_passports (
  token, serial_number, window_number, window_type, project_label,
  manufactured_date, warranty_no, warranty_expiry, specification
) values (
  '11111111-2222-3333-4444-555555555555',
  'PSW-2026-0042-W1',
  'W1',
  'Box sash window',
  'Elm Street, ground floor, front',
  '2026-03-14',
  'PSW-2026-00123',
  '2036-03-14',
  jsonb_build_object(
    'rows', jsonb_build_array(
      jsonb_build_object('label','Dimensions',       'value','896 x 1413 mm'),
      jsonb_build_object('label','Frame',            'value','Box sash, 164 mm'),
      jsonb_build_object('label','Timber',           'value','Engineered redwood'),
      jsonb_build_object('label','Glazing',          'value','Double 4-16-4, argon'),
      jsonb_build_object('label','Glass',            'value','Clear, toughened'),
      jsonb_build_object('label','Spacer',           'value','White'),
      jsonb_build_object('label','Colour ext / int', 'value','F&B Railings / White'),
      jsonb_build_object('label','Bars',             'value','1 vertical per sash'),
      jsonb_build_object('label','Ironmongery',      'value','Polished chrome'),
      jsonb_build_object('label','Security',         'value','PAS 24')
    ),
    'viewer3d', jsonb_build_object(
      'windowCategory','sash', 'extWidth', 896, 'extHeight', 1413,
      'sashType','double', 'upperBars', 1, 'lowerBars', 1, 'sameBars', true,
      'woodColorExt','#1F3D2B', 'woodColorInt','#FAFAFA', 'sameColor', false,
      'glassType','double', 'spacerColor','white'
    )
  )
) on conflict (serial_number) do nothing;

-- Open it at:  https://<your-domain>/p/11111111-2222-3333-4444-555555555555

-- ─── 2. QR plates ──────────────────────────────────────────

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

-- ─── 3. Projects (parent) ──────────────────────────────────

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
