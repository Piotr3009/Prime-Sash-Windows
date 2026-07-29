-- ============================================================
-- PRIME SASH WINDOWS — Safety net before editing a finished order
-- Run in Supabase → SQL Editor.
-- ============================================================
--
-- WHY: reopening a window in the configurator and pressing Update rewrites the
-- whole specification from the form. It is well tested, but a finished order is
-- data nobody double-checks any more — so take a copy first, compare after, and
-- restore if anything moved.
--
-- Replace 00017/01/2026 with your estimate number in STEP 1 only.

-- ─── STEP 1: take the snapshot (before editing) ────────────

create table if not exists public.spec_backup (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid,
  estimate_id   uuid,
  window_number text,
  specification jsonb,
  total_price   numeric,
  taken_at      timestamptz not null default now()
);

insert into public.spec_backup (item_id, estimate_id, window_number, specification, total_price)
select ei.id, ei.estimate_id, ei.window_number, ei.specification::jsonb, ei.total_price
from public.estimate_items ei
join public.estimates e on e.id = ei.estimate_id
where e.estimate_number = '00017/01/2026';

select count(*) as windows_backed_up from public.spec_backup;


-- ─── STEP 2: after editing, see what actually changed ──────
-- Ignores viewer3d and screenshots, which are SUPPOSED to change.
-- An empty result means the edit was clean.

select b.window_number,
       'price'                       as field,
       b.total_price::text           as before,
       ei.total_price::text          as after
from public.spec_backup b
join public.estimate_items ei on ei.id = b.item_id
where b.total_price is distinct from ei.total_price

union all

select b.window_number,
       key                           as field,
       (b.specification -> key)::text        as before,
       (ei.specification::jsonb -> key)::text as after
from public.spec_backup b
join public.estimate_items ei on ei.id = b.item_id
cross join lateral (
  select k as key
  from jsonb_object_keys(b.specification || ei.specification::jsonb) k
) keys
where key not in ('viewer3d', 'screenshots')
  and (b.specification -> key) is distinct from (ei.specification::jsonb -> key);


-- ─── STEP 3 (only if STEP 2 shows unwanted changes) ────────
-- Restores the original specification, keeping the newly captured viewer3d.
--
-- update public.estimate_items ei
--    set specification = (
--          b.specification || jsonb_build_object(
--            'viewer3d', ei.specification::jsonb -> 'viewer3d')
--        )::text,
--        total_price = b.total_price
--   from public.spec_backup b
--  where b.item_id = ei.id
--    and b.window_number = 'W1';   -- name the window to restore


-- ─── STEP 4: tidy up when you are happy ────────────────────
-- drop table public.spec_backup;
