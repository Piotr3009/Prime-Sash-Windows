-- ============================================================
-- PRIME SASH WINDOWS — Window Passport (Etap 1)
-- Run this whole file once in Supabase → SQL Editor.
-- Safe to re-run: everything is IF NOT EXISTS / OR REPLACE.
-- ============================================================
--
-- WHAT THIS IS
-- A passport is a permanent record of ONE physical window as it left the
-- workshop. A QR sticker on the window points at /p/<token>.
--
-- KEY DESIGN RULE: the passport is a FROZEN COPY, never a live reference.
-- Estimates get edited and deleted; a sticker on a window in a client's
-- house must not start lying or 404 because of that. Hence:
--   * specification holds a copy of the spec (rows + screenshots + viewer3d)
--   * estimate_item_id / estimate_id are PLAIN uuid columns with NO foreign
--     key, so no cascade can ever reach this table
--
-- ============================================================

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
