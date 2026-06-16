-- ============================================
-- Public Admin Bypass
-- Habilita que /admin funcione sin autenticación
-- ============================================

-- 1. Relajar políticas RLS para matches y prizes
drop policy if exists "Admins manage matches" on public.matches;
drop policy if exists "Anyone can manage matches" on public.matches;
create policy "Anyone can manage matches" on public.matches
  for all using (true) with check (true);

drop policy if exists "Admins can manage prizes" on public.prizes;
drop policy if exists "Anyone can manage prizes" on public.prizes;
create policy "Anyone can manage prizes" on public.prizes
  for all using (true) with check (true);

-- 2. Obtener todos los usuarios con wallet
create or replace function public.public_admin_get_users()
returns table (
  id uuid, rif text, nombre text, telefono text,
  zona text, vendedor text, empresa text,
  is_admin boolean, created_at timestamptz,
  wallet_balance numeric, wallet_earned numeric,
  wallet_wagered numeric, wallet_won numeric
) language plpgsql security definer as $$
begin
  return query
  select u.id, u.rif, u.nombre, u.telefono, u.zona, u.vendedor, u.empresa, u.is_admin, u.created_at,
         w.balance, w.total_earned, w.total_wagered, w.total_won
  from public.users u
  left join public.wallets w on w.user_id = u.id
  order by u.created_at desc;
end;
$$;

grant execute on function public.public_admin_get_users() to anon, authenticated;

-- 3. Crear usuario (sin check admin)
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
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
    values (v_user_id, p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(), jsonb_build_object('nombre', p_nombre, 'rif', p_rif), 'authenticated', 'authenticated', now(), now());
  end if;
  insert into public.users (id, rif, nombre, telefono, zona, vendedor, empresa, telefono_verificado, is_admin)
  values (v_user_id, p_rif, p_nombre, p_telefono, p_zona, p_vendedor, p_empresa, true, p_is_admin)
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

-- 4. Actualizar usuario (sin check admin)
create or replace function public.public_admin_update_user(
  p_user_id uuid, p_nombre text, p_rif text, p_telefono text,
  p_zona text, p_vendedor text, p_empresa text, p_is_admin boolean
) returns void language plpgsql security definer as $$
begin
  update public.users set
    nombre = p_nombre, rif = p_rif, telefono = p_telefono,
    zona = p_zona, vendedor = p_vendedor, empresa = p_empresa,
    is_admin = p_is_admin, updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.public_admin_update_user(uuid, text, text, text, text, text, text, boolean) to anon, authenticated;

-- 5. Eliminar usuario (sin check admin)
create or replace function public.public_admin_delete_user(p_user_id uuid) returns void language plpgsql security definer as $$
begin
  delete from public.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.public_admin_delete_user(uuid) to anon, authenticated;

-- 6. Broadcast notificación (sin check admin)
create or replace function public.public_admin_broadcast_notification(
  p_titulo text, p_mensaje text, p_tipo text default 'info'
) returns integer language plpgsql security definer as $$
declare v_count integer;
begin
  insert into public.notifications (user_id, titulo, mensaje, tipo, leida)
  select id, p_titulo, p_mensaje, p_tipo, false from public.users;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.public_admin_broadcast_notification(text, text, text) to anon, authenticated;
