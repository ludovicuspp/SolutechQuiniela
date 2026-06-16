-- Admin tool: void a pending bet, refund the wallet, and delete the bet row
-- so the user can place a new prediction on the same match.
-- Only pendiente bets can be voided; ganada/perdida bets are final.

create or replace function public.admin_void_bet(p_bet_id bigint)
returns void
language plpgsql security definer
as $$
declare
  v_bet record;
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  -- Fetch bet (only pendiente)
  select * into strict v_bet
  from public.bets
  where id = p_bet_id
    and estado = 'pendiente'
    and match_id is not null;

  -- Get wallet
  select id into strict v_wallet_id
  from public.wallets
  where user_id = v_bet.user_id;

  -- Refund: restore balance, subtract from total_wagered
  update public.wallets
  set balance = balance + v_bet.monto,
      total_wagered = greatest(0, total_wagered - v_bet.monto),
      updated_at = now()
  where id = v_wallet_id
  returning balance into v_new_balance;

  -- Log refund transaction
  insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
  values (v_wallet_id, v_bet.user_id, 'reembolso', v_bet.monto, v_new_balance,
          'Reembolso por anulación de apuesta #' || p_bet_id,
          p_bet_id::text);

  -- Delete the bet row (frees the unique index for re-predicting)
  delete from public.bets where id = p_bet_id;

exception
  when no_data_found then
    raise exception 'Apuesta no encontrada, ya fue resuelta o no está pendiente';
end;
$$;

-- Grant execute to authenticated users (admins)
grant execute on function public.admin_void_bet(bigint) to authenticated;
