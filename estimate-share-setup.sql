-- ═══════════════════════════════════════════════════════════════════════════
-- CLIENT SHARE LINKS FOR ESTIMATES  —  run once in Supabase SQL Editor
-- Adds estimates.share_token + a SECURITY DEFINER function so the public
-- share page can read ONE estimate by its token, without loosening RLS
-- and without any service key in the frontend / serverless env.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Token column (auto for new estimates) + backfill existing + fast lookup
alter table public.estimates
  add column if not exists share_token uuid not null default gen_random_uuid();

update public.estimates set share_token = gen_random_uuid() where share_token is null;

create unique index if not exists estimates_share_token_idx
  on public.estimates (share_token);

-- 2) Token-scoped read function.
--    SECURITY DEFINER: runs with owner rights, so RLS on the tables stays
--    fully locked for anon — the ONLY door is this function, and it returns
--    a single estimate matching the exact token.
--    Status gate: drafts stay private; link works from 'sent' onwards.
create or replace function public.get_shared_estimate(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est public.estimates%rowtype;
  v_result jsonb;
begin
  select * into v_est
  from public.estimates
  where share_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  -- Draft / cancelled are not shown to the client via link
  if v_est.status not in ('sent','quoted','confirmed','survey','in_production','completed') then
    return jsonb_build_object('preparing', true, 'estimate_number', v_est.estimate_number);
  end if;

  select jsonb_build_object(
    'id', v_est.id,
    'estimate_number', v_est.estimate_number,
    'project_name', v_est.project_name,
    'delivery_address', v_est.delivery_address,
    'status', v_est.status,
    'total_price', v_est.total_price,
    'notes', v_est.notes,
    'valid_until', v_est.valid_until,
    'created_at', v_est.created_at,
    'updated_at', v_est.updated_at,
    'share_token', v_est.share_token,
    'customers', (
      select jsonb_build_object('full_name', c.full_name, 'company_name', c.company_name)
      from public.customers c where c.id = v_est.customer_id
    ),
    'estimate_items', coalesce((
      select jsonb_agg(to_jsonb(ei) order by ei.window_number)
      from public.estimate_items ei where ei.estimate_id = v_est.id
    ), '[]'::jsonb),
    'extras', coalesce((
      select jsonb_agg(to_jsonb(ex) order by ex.created_at)
      from public.estimate_extras ex where ex.estimate_id = v_est.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- 3) Anon may call ONLY this function (needs the exact token to get anything)
revoke all on function public.get_shared_estimate(uuid) from public;
grant execute on function public.get_shared_estimate(uuid) to anon;
grant execute on function public.get_shared_estimate(uuid) to authenticated;
