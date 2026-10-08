-- ============================================================
-- PRIME SASH WINDOWS — Shared 3D designs: /d/<code>  (owner, 08.10.2026)
-- Applied to Supabase on 08.10.2026. Safe to re-run: IF NOT EXISTS / OR REPLACE.
-- ============================================================
--
-- WHAT THIS IS
-- "Share 3D link" in the configurator (Finalise step) stores the window's 3D
-- engine config here and gives a short link: /d/<code>. The page
-- (api/design-view.js) shows the window in 3D with our logo and a link to the
-- website. No estimate is needed.
--
-- SECURITY (the button is for every visitor — advertising)
--   * The table is locked (RLS on, no policies). The only doors are the two
--     SECURITY DEFINER functions below.
--   * Stored: the 3D engine config only. No prices, no names, no addresses.
--   * Only the owner (customers.role = 'admin') can give a link a title. A
--     visitor's page shows generated text only, so nobody can put their own
--     words on a page under our domain (no phishing text).
--   * Config validated: a JSON object under 60 KB, known window category,
--     numbers within the product range.
--   * Anti-spam: at most 30 new links per minute for the whole site and 20 per
--     hour from one connection (IP kept only as a salted hash). The owner is
--     exempt.
--   * Visitors' links expire after 30 days (expired rows are deleted in
--     batches whenever a new link is made). The owner's links never expire.
--   * Codes: 10 random characters (57-letter alphabet, no 0/O/1/l/I) — not
--     guessable, not sequential.
-- ============================================================

create table if not exists public.shared_designs (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,          -- public door: /d/<code>
  config          jsonb not null,                -- window.get3DConfig() — the exact engine config
  title           text,                          -- owner's links only (window reference)
  is_admin        boolean not null default false,
  created_by      uuid,                          -- auth.uid() when logged in
  ip_hash         text,                          -- sha256(ip + salt), rate limiting only
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,                   -- null = never (owner)
  views           integer not null default 0,
  last_viewed_at  timestamptz
);

create index if not exists shared_designs_created_idx on public.shared_designs (created_at desc);
create index if not exists shared_designs_expires_idx on public.shared_designs (expires_at);
create index if not exists shared_designs_ip_idx      on public.shared_designs (ip_hash, created_at desc);

alter table public.shared_designs enable row level security;
-- (no policies on purpose: nobody reads or writes the table directly)

-- ------------------------------------------------------------
-- Create a link. Returns {"code": "...", "expires_at": <timestamp|null>}.
-- ------------------------------------------------------------
create or replace function public.create_shared_design(p_config jsonb, p_title text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_uid      uuid := auth.uid();
  v_admin    boolean := false;
  v_headers  json;
  v_ip       text;
  v_ip_hash  text;
  v_title    text;
  v_expires  timestamptz;
  v_code     text;
  v_bytes    bytea;
  v_cat      text;
  v_w        numeric;
  v_h        numeric;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  k          text;
  i          int;
  attempt    int;
begin
  -- 1. The design: a JSON object of sane size, a known window, numbers in range
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'invalid design' using errcode = '22023';
  end if;
  if octet_length(p_config::text) > 60000 then
    raise exception 'design too large' using errcode = '22023';
  end if;
  v_cat := p_config->>'windowCategory';
  if v_cat is null or v_cat not in ('sash', 'casement', 'fix-only', 'door') then
    raise exception 'invalid design' using errcode = '22023';
  end if;
  if jsonb_typeof(p_config->'extWidth') is distinct from 'number'
     or jsonb_typeof(p_config->'extHeight') is distinct from 'number' then
    raise exception 'invalid design' using errcode = '22023';
  end if;
  v_w := (p_config->>'extWidth')::numeric;
  v_h := (p_config->>'extHeight')::numeric;
  if v_w < 200 or v_w > 15000 or v_h < 200 or v_h > 5000 then
    raise exception 'invalid design' using errcode = '22023';
  end if;
  if jsonb_typeof(p_config->'multiUnits') = 'array' then
    if jsonb_array_length(p_config->'multiUnits') > 6
       or exists (select 1 from jsonb_array_elements(p_config->'multiUnits') e
                  where jsonb_typeof(e) <> 'number' or (e #>> '{}')::numeric < 100 or (e #>> '{}')::numeric > 3000) then
      raise exception 'invalid design' using errcode = '22023';
    end if;
  end if;
  foreach k in array array['baySideWidth', 'bayPostWidth', 'bayPostDepth'] loop
    if coalesce(jsonb_typeof(p_config->k), 'null') <> 'null' then   -- key present and not null
      if jsonb_typeof(p_config->k) <> 'number'
         or (p_config->>k)::numeric < 100 or (p_config->>k)::numeric > 3000 then
        raise exception 'invalid design' using errcode = '22023';
      end if;
    end if;
  end loop;

  -- 2. Who: the owner (admin) may title a link and it never expires
  if v_uid is not null then
    select exists (select 1 from public.customers c where c.user_id = v_uid and c.role = 'admin') into v_admin;
  end if;

  -- 3. Anti-spam (the owner is exempt)
  if not v_admin then
    if (select count(*) from public.shared_designs where created_at > now() - interval '1 minute') >= 30 then
      raise exception 'busy' using errcode = 'P0001', hint = 'try again in a minute';
    end if;
    begin
      v_headers := current_setting('request.headers', true)::json;
    exception when others then
      v_headers := null;
    end;
    v_ip := nullif(trim(split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1)), '');
    if v_ip is not null then
      v_ip_hash := encode(digest(v_ip || ':psw-share-3d', 'sha256'), 'hex');
      if (select count(*) from public.shared_designs
          where ip_hash = v_ip_hash and created_at > now() - interval '1 hour') >= 20 then
        raise exception 'too many links' using errcode = 'P0001', hint = 'try again later';
      end if;
    end if;
  end if;

  -- 4. Housekeeping: drop a batch of expired links
  delete from public.shared_designs
  where id in (select id from public.shared_designs
               where expires_at is not null and expires_at < now()
               order by expires_at limit 100);

  -- 5. Title (owner only: printable text, 80 characters) and expiry
  if v_admin then
    v_title := nullif(btrim(left(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', ' ', 'g'), 80)), '');
    v_expires := null;
  else
    v_title := null;
    v_expires := now() + interval '30 days';
  end if;

  -- 6. A unique random code
  for attempt in 1..5 loop
    v_bytes := gen_random_bytes(10);
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    begin
      insert into public.shared_designs (code, config, title, is_admin, created_by, ip_hash, expires_at)
      values (v_code, p_config, v_title, v_admin, v_uid, v_ip_hash, v_expires);
      return jsonb_build_object('code', v_code, 'expires_at', v_expires);
    exception when unique_violation then
      -- extremely unlikely: try another code
    end;
  end loop;
  raise exception 'could not create a link' using errcode = 'P0001';
end;
$$;

-- ------------------------------------------------------------
-- Read a link (the /d/<code> page). null = no such link,
-- {"expired": true} = expired, else the design. Counts the view.
-- ------------------------------------------------------------
create or replace function public.get_shared_design(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  r public.shared_designs%rowtype;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{6,16}$' then
    return null;
  end if;
  select * into r from public.shared_designs where code = p_code;
  if not found then
    return null;
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return jsonb_build_object('expired', true);
  end if;
  update public.shared_designs set views = views + 1, last_viewed_at = now() where id = r.id;
  return jsonb_build_object(
    'code',       r.code,
    'config',     r.config,
    'title',      r.title,
    'created_at', r.created_at,
    'expires_at', r.expires_at
  );
end;
$$;

revoke all on function public.create_shared_design(jsonb, text) from public;
revoke all on function public.get_shared_design(text) from public;
grant execute on function public.create_shared_design(jsonb, text) to anon, authenticated;
grant execute on function public.get_shared_design(text) to anon, authenticated;
