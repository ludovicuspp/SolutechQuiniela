-- ============================================================
-- Simple multipliers: ganador ×2, empate ×3, resultado_exacto ×5
-- Run this in Supabase SQL Editor (single execution)
--
-- Cambios:
--   1. get_bet_multiplier → fijo por tipo, independiente de la fase
--   2. Check constraint bets.tipo_apuesta: agrega 'empate', quita 'diferencia_goles'
--   3. place_bet → acepta 'empate' como tipo válido
--   4. resolve_match_bets → maneja tipo_apuesta = 'empate'
-- ============================================================

-- 1. Multiplicador fijo por tipo (ignora fase)
create or replace function public.get_bet_multiplier(p_fase text, p_tipo text)
returns numeric
language sql immutable
as $$
  select case p_tipo
    when 'ganador'         then 2.0
    when 'empate'          then 3.0
    when 'resultado_exacto' then 5.0
    else 2.0
  end;
$$;

-- 2. Check constraint: reemplazar 'diferencia_goles' por 'empate'
alter table public.bets drop constraint if exists bets_tipo_apuesta_check;
alter table public.bets add constraint bets_tipo_apuesta_check
  check (tipo_apuesta in ('ganador', 'empate', 'resultado_exacto'));

-- 3. place_bet — acepta 'empate', quita 'diferencia_goles'
create or replace function public.place_bet(
  p_user_id uuid,
  p_external_id integer,
  p_tipo_apuesta text,
  p_prediccion jsonb,
  p_monto numeric,
  p_fase text,
  p_grupo text,
  p_jornada integer,
  p_equipo_local text,
  p_equipo_visitante text,
  p_codigo_local text,
  p_codigo_visitante text,
  p_bandera_local text,
  p_bandera_visitante text,
  p_sede text,
  p_fecha_partido timestamptz
) returns uuid as $$
declare
  v_wallet_id          uuid;
  v_balance            numeric;
  v_bet_id             uuid;
  v_multiplicador      numeric;
  v_ganancia_potencial numeric;
  v_match_id           uuid;
begin
  -- ── Autorización: solo puedes apostar por ti mismo ──
  if p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado';
  end if;

  -- ── Validaciones de entrada ──
  if p_monto is null or p_monto <= 0 then
    raise exception 'Monto inválido';
  end if;
  if p_tipo_apuesta not in ('ganador','empate','resultado_exacto') then
    raise exception 'Tipo de apuesta inválido';
  end if;
  if p_tipo_apuesta = 'resultado_exacto' then
    if coalesce((p_prediccion->>'goles_local')::int, -1) not between 0 and 20
       or coalesce((p_prediccion->>'goles_visitante')::int, -1) not between 0 and 20 then
      raise exception 'Predicción fuera de rango (0-20)';
    end if;
  end if;

  -- ── Multiplicador autoritativo (server-side) ──
  v_multiplicador := public.get_bet_multiplier(p_fase, p_tipo_apuesta);

  -- ── Upsert del partido ──
  insert into public.matches (
    external_id, fase, grupo, jornada,
    equipo_local, equipo_visitante,
    codigo_local, codigo_visitante,
    bandera_local, bandera_visitante,
    sede, fecha_partido,
    estado, apuestas_abiertas
  ) values (
    p_external_id, p_fase, p_grupo, p_jornada,
    p_equipo_local, p_equipo_visitante,
    p_codigo_local, p_codigo_visitante,
    p_bandera_local, p_bandera_visitante,
    p_sede, p_fecha_partido,
    'programado', true
  )
  on conflict (external_id) do update set
    fase              = excluded.fase,
    grupo             = excluded.grupo,
    jornada           = excluded.jornada,
    equipo_local      = excluded.equipo_local,
    equipo_visitante  = excluded.equipo_visitante,
    codigo_local      = excluded.codigo_local,
    codigo_visitante  = excluded.codigo_visitante,
    bandera_local     = excluded.bandera_local,
    bandera_visitante = excluded.bandera_visitante,
    sede              = excluded.sede,
    fecha_partido     = excluded.fecha_partido,
    updated_at        = now()
  returning id into v_match_id;

  -- ── Anti-duplicado ──
  if exists (select 1 from public.bets where user_id = p_user_id and match_id = v_match_id) then
    raise exception 'Ya tienes una apuesta en este partido';
  end if;

  -- ── Wallet y saldo ──
  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_wallet_id is null then
    raise exception 'Wallet no encontrada';
  end if;
  if v_balance < p_monto then
    raise exception 'Saldo insuficiente. Tienes %.2f puntos, necesitas %.2f', v_balance, p_monto;
  end if;

  -- ── Verificar que el partido sigue en estado programado ──
  if not exists (
    select 1 from public.matches
    where id = v_match_id
      and estado = 'programado'
  ) then
    raise exception 'Este partido no está disponible para pronosticar';
  end if;

  v_ganancia_potencial := p_monto * v_multiplicador;

  -- ── Descontar saldo ──
  update public.wallets
  set balance       = balance - p_monto,
      total_wagered = total_wagered + p_monto,
      updated_at    = now()
  where id = v_wallet_id;

  -- ── Crear apuesta ──
  insert into public.bets (
    user_id, match_id, match_external_id,
    tipo_apuesta, prediccion, monto,
    multiplicador, ganancia_potencial
  ) values (
    p_user_id, v_match_id, p_external_id,
    p_tipo_apuesta, p_prediccion, p_monto,
    v_multiplicador, v_ganancia_potencial
  )
  returning id into v_bet_id;

  -- ── Transacción ──
  insert into public.wallet_transactions (
    wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia
  ) values (
    v_wallet_id, p_user_id, 'apuesta', -p_monto, v_balance - p_monto,
    'Pronóstico en partido', v_bet_id::text
  );

  return v_bet_id;
end;
$$ language plpgsql security definer;

-- 4. resolve_match_bets — reemplazar diferencia_goles por empate
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
      if v_match.goles_local > v_match.goles_visitante and v_bet.prediccion->>'resultado' = 'local' then
        v_won := true;
      elsif v_match.goles_visitante > v_match.goles_local and v_bet.prediccion->>'resultado' = 'visitante' then
        v_won := true;
      elsif v_match.goles_local = v_match.goles_visitante and v_bet.prediccion->>'resultado' = 'empate' then
        v_won := true;
      end if;

    elsif v_bet.tipo_apuesta = 'empate' then
      if v_match.goles_local = v_match.goles_visitante then
        v_won := true;
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
