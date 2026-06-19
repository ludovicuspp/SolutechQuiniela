-- ============================================================
-- admin_resolve_match: RPC administrativo para resolver/
-- re-resolver apuestas de un partido finalizado con soporte de
-- penales y reversión de resultados previos.
-- ============================================================

-- 1) REVOKE resolve_match_bets de clientes — solo trigger/definer
revoke execute on function public.resolve_match_bets(uuid) from anon, authenticated, public;

-- 2) Blindar admin_set_penalties con is_admin()
create or replace function public.admin_set_penalties(
  p_match_id uuid,
  p_pen_local integer,
  p_pen_visitante integer
) returns void
language plpgsql security definer
as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  update public.matches
  set penales_local = p_pen_local,
      penales_visitante = p_pen_visitante,
      updated_at = now()
  where id = p_match_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
end;
$$;

-- 3) Blindar assign_phase_prizes con is_admin()
create or replace function public.assign_phase_prizes(p_fase text)
returns void
language plpgsql security definer
as $$
declare
  v_ranking record;
  v_prize   record;
  v_pos     integer;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  delete from public.prize_winners where fase = p_fase;
  for v_ranking in
    select * from public.get_phase_ranking(p_fase) limit 3
  loop
    v_pos := v_ranking.posicion;
    select * into v_prize
    from public.prizes
    where fase = p_fase and posicion = v_pos
    limit 1;
    insert into public.prize_winners (id, prize_id, user_id, fase, posicion, created_at)
    values (gen_random_uuid(), v_prize.id, v_ranking.user_id, p_fase, v_pos, now());
    insert into public.notifications (user_id, titulo, mensaje, tipo, data)
    values (
      v_ranking.user_id,
      case v_pos
        when 1 then 'Ganaste el 1er Premio!'
        when 2 then 'Ganaste el 2do Premio!'
        when 3 then 'Ganaste el 3er Premio!'
      end,
      case
        when v_prize.id is not null then
          'Felicitaciones! Ganaste el premio "' || v_prize.titulo || '" en la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
        else
          'Felicitaciones! Quedaste en la posicion ' || v_pos || ' de la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
      end,
      'success',
      jsonb_build_object('fase', p_fase, 'posicion', v_pos, 'puntos', v_ranking.puntos, 'prize_id', v_prize.id)
    );
  end loop;
end;
$$;

-- 4) RPC principal: admin_resolve_match
create or replace function public.admin_resolve_match(
  p_match_id uuid,
  p_pen_local integer default null,
  p_pen_visitante integer default null
) returns jsonb
language plpgsql security definer
as $$
declare
  v_match record;
  v_bet record;
  v_revertidas int := 0;
  v_ganadas int := 0;
  v_perdidas int := 0;
  v_wallet record;
  v_new_balance numeric;
begin
  -- Solo admin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;

  -- Validar partido
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if v_match.estado != 'finalizado' then
    raise exception 'El partido debe estar finalizado para resolver apuestas';
  end if;

  -- Establecer penales si se proporcionaron
  if p_pen_local is not null and p_pen_visitante is not null then
    update public.matches
    set penales_local = p_pen_local,
        penales_visitante = p_pen_visitante,
        updated_at = now()
    where id = p_match_id;
  end if;

  -- Revertir apuestas ya resueltas (ganada/perdida → pendiente)
  for v_bet in
    select * from public.bets
    where match_id = p_match_id and estado in ('ganada', 'perdida')
  loop
    if v_bet.estado = 'ganada' then
      -- Revertir wallet
      select * into v_wallet from public.wallets where user_id = v_bet.user_id;
      if v_wallet.id is not null then
        update public.wallets
        set balance = balance - v_bet.ganancia_real,
            total_won = total_won - v_bet.ganancia_real,
            updated_at = now()
        where id = v_wallet.id
        returning balance into v_new_balance;
        -- Registrar reversión
        insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
        values (v_wallet.id, v_bet.user_id, 'reembolso', -v_bet.ganancia_real, v_new_balance,
          'Reversion de apuesta ganada - ' || v_bet.tipo_apuesta, v_bet.id::text);
      end if;
    end if;

    -- Resetear bet a pendiente
    update public.bets
    set estado = 'pendiente', ganancia_real = 0, updated_at = now()
    where id = v_bet.id;

    -- Eliminar notificaciones viejas de resultado de esta apuesta
    delete from public.notifications
    where data->>'bet_id' = v_bet.id::text and tipo = 'bet_result';

    v_revertidas := v_revertidas + 1;
  end loop;

  -- Marcar como no verificado para que resolve_match_bets lo setee
  update public.matches set resultado_verificado = false where id = p_match_id;

  -- Re-resolver
  perform public.resolve_match_bets(p_match_id);

  -- Contar resultados
  select count(*) into v_ganadas from public.bets where match_id = p_match_id and estado = 'ganada';
  select count(*) into v_perdidas from public.bets where match_id = p_match_id and estado = 'perdida';

  return jsonb_build_object(
    'revertidas', v_revertidas,
    'ganadas', v_ganadas,
    'perdidas', v_perdidas,
    'total', v_revertidas + v_ganadas + v_perdidas
  );
end;
$$;

grant execute on function public.admin_resolve_match(uuid, integer, integer) to authenticated;
