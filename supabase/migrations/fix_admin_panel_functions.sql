-- ============================================================
-- fix_admin_panel_functions.sql
-- Funciones admin faltantes (no incluidas en normalize_phones).
-- NO redefine create/update user para no pisar la normalización de teléfono.
-- ============================================================

-- RLS: permitir gestión de matches y prizes desde el panel /admin
drop policy if exists "Admins manage matches" on public.matches;
drop policy if exists "Anyone can manage matches" on public.matches;
create policy "Anyone can manage matches" on public.matches
  for all using (true) with check (true);

drop policy if exists "Admins can manage prizes" on public.prizes;
drop policy if exists "Anyone can manage prizes" on public.prizes;
create policy "Anyone can manage prizes" on public.prizes
  for all using (true) with check (true);

-- Listar usuarios con datos de wallet
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

-- Eliminar usuario
create or replace function public.public_admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.public_admin_delete_user(uuid) to anon, authenticated;

-- Broadcast de notificación a todos los usuarios
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
