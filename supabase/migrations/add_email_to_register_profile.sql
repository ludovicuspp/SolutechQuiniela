-- ============================================
-- Migración: Soporte de email como dato de contacto (no credencial)
-- El email se guarda en public.users pero no se usa para Auth.
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Añadir columna email a la tabla users
alter table public.users
  add column if not exists email text;

-- 2. Actualizar register_profile para que reciba email + alias
--    y los guarde en public.users
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

  -- Si no se pasó alias, usar el primer nombre como fallback
  v_alias := coalesce(nullif(p_alias, ''), split_part(p_nombre, ' ', 1));

  insert into public.users (id, rif, nombre, telefono, telefono_verificado, email, alias, empresa, zona, vendedor)
  values (
    v_uid,
    p_rif,
    p_nombre,
    p_telefono,
    true,
    coalesce(nullif(p_email, ''), null),
    v_alias,
    coalesce(p_empresa, ''),
    coalesce(p_zona, ''),
    coalesce(p_vendedor, '')
  );

  insert into public.wallets (user_id, balance, total_earned)
  values (v_uid, coalesce(p_puntos, 0), coalesce(p_puntos, 0))
  returning id into v_wallet_id;

  if coalesce(p_puntos, 0) > 0 then
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_uid, 'compra', p_puntos, p_puntos, 'Puntos iniciales por compras anteriores', 'registro_inicial');
  end if;
end;
$$ language plpgsql security definer;

-- 3. Permitir al usuario actualizar su propio email
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
