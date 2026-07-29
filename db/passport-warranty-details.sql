-- ============================================================
-- PRIME SASH WINDOWS — Passport: real warranty certificate details
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Requires db/passport-setup-all.sql, db/passport-uvalue.sql and
-- db/passport-timber.sql to have been run first.
-- ============================================================
--
-- The passport's "Download warranty" button opens warranty-certificate.html
-- filled from URL params. The certificate needs the client name, property
-- address and order reference — and those live in warranty_certificates,
-- which the previous RPC never touched. Result: a scanned passport produced
-- a certificate with a real number but blank client/address — not the real
-- document.
--
-- Fix: join warranty_certificates by the warranty number assigned to the
-- passport project (window's own column stays as the Etap 1/2 fallback) and
-- expose the certificate's identifying fields. SECURITY DEFINER bypasses RLS,
-- so the anon-key call keeps working; only these named fields leak, never the
-- whole row. Re-running this file also guarantees the live functions are the
-- newest shape (project join + u_value + timber + warranty coalesce), in case
-- an older definition file was run last.

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
    'cert_client_name',  wc.client_name,
    'cert_address',      wc.property_address,
    'cert_order_ref',    wc.order_reference,
    'cert_mfg_date',     wc.manufacturing_date,
    'specification',     wp.specification,
    'attachments',       case
                           when pp.documents is not null and jsonb_array_length(pp.documents) > 0
                             then pp.documents
                           else wp.attachments
                         end
  )
  from public.window_passports wp
  left join public.passport_projects pp on pp.id = wp.project_id
  left join public.warranty_certificates wc
         on wc.warranty_no = coalesce(pp.warranty_no, wp.warranty_no)
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
    'cert_client_name',  wc.client_name,
    'cert_address',      wc.property_address,
    'cert_order_ref',    wc.order_reference,
    'cert_mfg_date',     wc.manufacturing_date,
    'specification',     wp.specification,
    'attachments',       case
                           when pp.documents is not null and jsonb_array_length(pp.documents) > 0
                             then pp.documents
                           else wp.attachments
                         end
  )
  from public.window_passports wp
  left join public.passport_projects pp on pp.id = wp.project_id
  left join public.warranty_certificates wc
         on wc.warranty_no = coalesce(pp.warranty_no, wp.warranty_no)
  where wp.plate_code = p_code;
$$;

grant execute on function public.get_window_passport(uuid) to anon, authenticated;
grant execute on function public.get_window_passport_by_plate(text) to anon, authenticated;
