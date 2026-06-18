-- ============================================================
-- Fix 1: auto_resolve_bets_on_match_end — trigger ahora
-- verifica transición de estado en vez de resultado_verificado
-- ============================================================
-- Motivo: sync-matches + batch_upsert_matches setean
-- resultado_verificado=true antes de que el trigger se dispare,
-- por lo que "not new.resultado_verificado" siempre daba false
-- y resolve_match_bets nunca se llamaba.
-- ============================================================

create or replace function public.auto_resolve_bets_on_match_end() returns trigger as $$
begin
  if new.estado = 'finalizado' and old.estado != 'finalizado' then
    perform public.resolve_match_bets(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_auto_resolve_bets on public.matches;
create trigger trigger_auto_resolve_bets
  after update on public.matches
  for each row
  execute function public.auto_resolve_bets_on_match_end();

-- ============================================================
-- Fix 2: resolve_match_bets — soporte de penales
-- Cuando goles_local = goles_visitante y hay penales,
-- se usa el resultado de penales para determinar ganador.
-- ============================================================

create or replace function public.resolve_match_bets(
  p_match_id uuid
) returns void as $$
declare
  v_match record;
  v_bet record;
  v_won boolean;
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  select * into v_match from public.matches where id = p_match_id and estado = 'finalizado';
  if not found then
    raise exception 'Partido no encontrado o no finalizado';
  end if;

  for v_bet in
    select * from public.bets
    where match_id = p_match_id and estado = 'pendiente'
  loop
    v_won := false;

    if v_bet.tipo_apuesta = 'ganador' then
      if v_match.goles_local > v_match.goles_visitante then
        v_won := v_bet.prediccion->>'resultado' = 'local';
      elsif v_match.goles_visitante > v_match.goles_local then
        v_won := v_bet.prediccion->>'resultado' = 'visitante';
      else
        -- Empate — verificar penales
        if v_match.penales_local is not null and v_match.penales_visitante is not null
           and v_match.penales_local != v_match.penales_visitante then
          if v_match.penales_local > v_match.penales_visitante then
            v_won := v_bet.prediccion->>'resultado' = 'local';
          else
            v_won := v_bet.prediccion->>'resultado' = 'visitante';
          end if;
        else
          v_won := v_bet.prediccion->>'resultado' = 'empate';
        end if;
      end if;

    elsif v_bet.tipo_apuesta = 'empate' then
      if v_match.goles_local = v_match.goles_visitante then
        -- Si hay penales y un equipo ganó, el empate pierde
        if v_match.penales_local is not null and v_match.penales_visitante is not null
           and v_match.penales_local != v_match.penales_visitante then
          v_won := false;
        else
          v_won := true;
        end if;
      end if;

    elsif v_bet.tipo_apuesta = 'resultado_exacto' then
      if v_match.goles_local = (v_bet.prediccion->>'goles_local')::integer
        and v_match.goles_visitante = (v_bet.prediccion->>'goles_visitante')::integer then
        v_won := true;
      end if;
    end if;

    if v_won then
      select id into v_wallet_id from public.wallets where user_id = v_bet.user_id;
      update public.wallets
      set balance = balance + v_bet.ganancia_potencial,
          total_won = total_won + v_bet.ganancia_potencial,
          updated_at = now()
      where user_id = v_bet.user_id
      returning balance into v_new_balance;
      update public.bets
      set estado = 'ganada', ganancia_real = v_bet.ganancia_potencial, updated_at = now()
      where id = v_bet.id;
      insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
      values (v_wallet_id, v_bet.user_id, 'ganancia', v_bet.ganancia_potencial, v_new_balance,
        'Ganancia apuesta - ' || v_bet.tipo_apuesta, v_bet.id::text);
      insert into public.notifications (user_id, titulo, mensaje, tipo, data)
      values (v_bet.user_id,
        'Apuesta ganada!',
        'Ganaste ' || v_bet.ganancia_potencial || ' puntos en tu apuesta de ' || v_bet.tipo_apuesta,
        'bet_result',
        jsonb_build_object('bet_id', v_bet.id, 'won', true, 'amount', v_bet.ganancia_potencial));
    else
      update public.bets
      set estado = 'perdida', updated_at = now()
      where id = v_bet.id;
      insert into public.notifications (user_id, titulo, mensaje, tipo, data)
      values (v_bet.user_id,
        'Apuesta perdida',
        'Tu apuesta de ' || v_bet.tipo_apuesta || ' por ' || v_bet.monto || ' puntos no acerto',
        'bet_result',
        jsonb_build_object('bet_id', v_bet.id, 'won', false, 'amount', v_bet.monto));
    end if;
  end loop;

  update public.matches set resultado_verificado = true where id = p_match_id;
end;
$$ language plpgsql security definer;
