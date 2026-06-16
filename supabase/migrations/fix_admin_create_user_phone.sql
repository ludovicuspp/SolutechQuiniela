-- ============================================================
-- Fix: public_admin_create_user sobrescribe teléfono en conflicto
-- Bug: ON CONFLICT (id) DO NOTHING silenciaba la actualización
--      del teléfono cuando public.users ya existía.
--      → get_email_by_phone no encontraba el número → login falla
-- ============================================================

-- Recrear con DO UPDATE SET para todos los campos relevantes
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
  values (v_user_id, p_rif, p_nombre, p_telefono, p_zona, p_vendedor, p_empresa, true, p_is_admin)
  on conflict (id) do update set
    rif       = excluded.rif,
    nombre    = excluded.nombre,
    telefono  = excluded.telefono,
    zona      = excluded.zona,
    vendedor  = excluded.vendedor,
    empresa   = excluded.empresa,
    is_admin  = excluded.is_admin;
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

-- ============================================================
-- DIAGNÓSTICO: verificar qué teléfono tiene cada usuario
-- ============================================================
-- Para diagnosticar el problema, ejecutar en Supabase SQL Editor:
--
-- select pu.id, pu.nombre, pu.telefono, right(regexp_replace(pu.telefono, '\D', '', 'g'), 7) as ultimos_7, au.email
-- from public.users pu
-- join auth.users au on au.id = pu.id
-- where pu.telefono is not null and pu.telefono <> ''
-- order by pu.created_at desc;
