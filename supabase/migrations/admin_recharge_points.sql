-- Migración: admin_recharge_points
-- Reemplaza el flujo ERP de add_purchase_points por recarga directa del admin.
-- El admin selecciona un empleado, escribe puntos y una nota opcional.
create or replace function public.admin_recharge_points(
  p_user_id uuid,
  p_puntos numeric,
  p_descripcion text default 'Recarga de puntos'
) returns numeric as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  if p_puntos <= 0 then
    raise exception 'Los puntos deben ser mayor a 0';
  end if;

  -- Obtener o crear wallet
  select id into v_wallet_id from public.wallets where user_id = p_user_id for update;
  if v_wallet_id is null then
    insert into public.wallets (user_id, balance, total_earned)
    values (p_user_id, 0, 0)
    returning id into v_wallet_id;
  end if;

  -- Sumar puntos
  update public.wallets
  set balance = balance + p_puntos,
      total_earned = total_earned + p_puntos,
      updated_at = now()
  where id = v_wallet_id
  returning balance into v_new_balance;

  -- Registrar transacción
  insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion)
  values (v_wallet_id, p_user_id, 'compra', p_puntos, v_new_balance, p_descripcion);

  return v_new_balance;
end;
$$ language plpgsql security definer;

grant execute on function public.admin_recharge_points(uuid, numeric, text) to anon, authenticated;
