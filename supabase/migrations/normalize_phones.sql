-- ============================================================
-- normalize_phones.sql
-- Normaliza todos los teléfonos venezolanos al formato canónico
-- de 10 dígitos (4XXXXXXXXX), tanto en escritura como en lectura.
--
-- Pasos:
--   1. Crea normalize_phone_ve(text)
--   2. Backfill: UPDATE de registros existentes
--   3. phone_exists → normaliza antes de comparar
--   4. get_email_by_phone → normaliza antes de buscar
--   5. public_admin_create_user → normaliza teléfono
--   6. public_admin_update_user → normaliza teléfono
--   7. register_profile → normaliza teléfono
--
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. Función de normalización VE
--    Extrae todos los dígitos, devuelve los últimos 10.
--    Ejemplos:
--      '+584246258204'  → '4246258204'
--      '04246258204'    → '4246258204'
--      '0424-625.82.04' → '4246258204'
--      '4246258204'     → '4246258204'
--      ''               → null
-- ────────────────────────────────────────────────
create or replace function public.normalize_phone_ve(p_telefono text)
returns text
language sql immutable
as $$
  select case
    when length(regexp_replace(p_telefono, '\D', '', 'g')) >= 10
    then right(regexp_replace(p_telefono, '\D', '', 'g'), 10)
    else nullif(regexp_replace(p_telefono, '\D', '', 'g'), '')
  end;
$$;

-- ────────────────────────────────────────────────
-- 2. Backfill: normalizar teléfonos existentes
-- ────────────────────────────────────────────────
update public.users
set telefono = public.normalize_phone_ve(telefono)
where telefono is not null and telefono <> '';

-- ────────────────────────────────────────────────
-- 3. phone_exists — misma normalización
-- ────────────────────────────────────────────────
create or replace function public.phone_exists(p_telefono text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.users pu
    where pu.telefono is not null
      and pu.telefono <> ''
      and public.normalize_phone_ve(pu.telefono) = public.normalize_phone_ve(p_telefono)
  );
$$;

grant execute on function public.phone_exists(text) to anon, authenticated;

-- ────────────────────────────────────────────────
-- 4. get_email_by_phone — match exacto de 10 dígitos
-- ────────────────────────────────────────────────
create or replace function public.get_email_by_phone(p_telefono text)
returns text
language plpgsql security definer stable
as $$
declare
  v_email text;
  v_normalized text;
begin
  v_normalized := public.normalize_phone_ve(p_telefono);
  if v_normalized is null then
    return null;
  end if;
  select au.email into v_email
  from public.users pu
  join auth.users au on au.id = pu.id
  where pu.telefono is not null
    and pu.telefono <> ''
    and public.normalize_phone_ve(pu.telefono) = v_normalized
  limit 1;
  return v_email;
end;
$$;

grant execute on function public.get_email_by_phone(text) to anon, authenticated;

-- ────────────────────────────────────────────────
-- 5. public_admin_create_user — normaliza teléfono
-- ────────────────────────────────────────────────
create or replace function public.public_admin_create_user(
  p_email text, p_password text, p_rif text, p_nombre text,
  p_telefono text default '', p_zona text default '',
  p_vendedor text default '', p_empresa text default '',
  p_puntos numeric default 0, p_is_admin boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email limit 1;
  if v_user_id is null then
    v_user_id := extensions.uuid_generate_v4();
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_confirm_status
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      p_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nombre', p_nombre, 'rif', p_rif),
      now(), now(),
      '', '', '', '', 0
    );
  end if;
  insert into public.users (id, rif, nombre, telefono, zona, vendedor, empresa, telefono_verificado, is_admin)
  values (v_user_id, p_rif, p_nombre, public.normalize_phone_ve(p_telefono), p_zona, p_vendedor, p_empresa, true, p_is_admin)
  on conflict (id) do nothing;
  insert into public.wallets (user_id, balance, total_earned) values (v_user_id, p_puntos, p_puntos) on conflict (user_id) do nothing;
  if p_puntos > 0 then
    select id into v_wallet_id from public.wallets where user_id = v_user_id;
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_user_id, 'compra', p_puntos, p_puntos, 'Puntos iniciales por administrador', 'admin_created');
  end if;
  return v_user_id;
end;
$$;

grant execute on function public.public_admin_create_user(text, text, text, text, text, text, text, text, numeric, boolean) to anon, authenticated;

-- ────────────────────────────────────────────────
-- 6. public_admin_update_user — normaliza teléfono
-- ────────────────────────────────────────────────
create or replace function public.public_admin_update_user(
  p_user_id uuid, p_nombre text, p_rif text, p_telefono text,
  p_zona text, p_vendedor text, p_empresa text, p_is_admin boolean
) returns void language plpgsql security definer as $$
begin
  update public.users set
    nombre    = p_nombre,
    rif       = p_rif,
    telefono  = public.normalize_phone_ve(p_telefono),
    zona      = p_zona,
    vendedor  = p_vendedor,
    empresa   = p_empresa,
    is_admin  = p_is_admin,
    updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.public_admin_update_user(uuid, text, text, text, text, text, text, boolean) to anon, authenticated;

-- ────────────────────────────────────────────────
-- 7. register_profile — normaliza teléfono antes de INSERT
-- ────────────────────────────────────────────────
create or replace function public.register_profile(
  p_rif text,
  p_nombre text,
  p_telefono text,
  p_email text default '',
  p_alias text default '',
  p_empresa text default '',
  p_zona text default '',
  p_vendedor text default '',
  p_puntos numeric default 0
) returns void as $$
declare
  v_uid uuid;
  v_wallet_id uuid;
  v_alias text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Sesión requerida para registrar el perfil';
  end if;

  v_alias := coalesce(nullif(p_alias, ''), split_part(p_nombre, ' ', 1));

  insert into public.users (id, rif, nombre, telefono, telefono_verificado, email, alias, empresa, zona, vendedor)
  values (
    v_uid,
    p_rif,
    p_nombre,
    public.normalize_phone_ve(p_telefono),
    true,
    nullif(coalesce(p_email, ''), ''),
    v_alias,
    coalesce(p_empresa, ''),
    coalesce(p_zona, ''),
    coalesce(p_vendedor, '')
  );

  insert into public.wallets (user_id, balance, total_earned)
  values (v_uid, coalesce(p_puntos,0), coalesce(p_puntos,0))
  returning id into v_wallet_id;

  if coalesce(p_puntos,0) > 0 then
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_uid, 'compra', p_puntos, p_puntos, 'Puntos iniciales por compras anteriores', 'registro_inicial');
  end if;
end;
$$ language plpgsql security definer;

grant execute on function public.register_profile(text, text, text, text, text, text, text, text, numeric) to anon, authenticated;
