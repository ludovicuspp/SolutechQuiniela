-- ============================================
-- ⚠️  SUPERSEDIDO por remove_betting_restrictions.sql
-- Migración: Time-Lock server-side en place_bet()
-- La ventana de pronóstico se valida con now() del servidor PostgreSQL
-- (America/Caracas = UTC-4) para evitar manipulación desde el cliente.
--
-- Regla de negocio (ya no vigente):
--   APERTURA : 00:00 del día ANTERIOR al partido (hora Venezuela)
--   CIERRE   : 12:00 PM del mismo día del partido (hora Venezuela)
--
-- Ejecuta remove_betting_restrictions.sql en su lugar.
-- ============================================

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

  -- Hora actual en Venezuela (UTC-4) según el reloj del SERVIDOR
  v_now_ven            timestamptz := now() at time zone 'America/Caracas';

  -- Fecha del partido en Venezuela (solo la parte de fecha)
  v_partido_ven        date := (p_fecha_partido at time zone 'America/Caracas')::date;

  -- Ventana de pronóstico (server-side, a prueba de manipulación)
  v_ventana_inicio     timestamptz := (v_partido_ven - interval '1 day')::timestamp
                                       at time zone 'America/Caracas'; -- 00:00 día anterior VEN
  v_ventana_cierre     timestamptz := v_partido_ven::timestamp + interval '12 hours'
                                       at time zone 'America/Caracas'; -- 12:00 PM día partido VEN
begin
  -- ── Autorización: solo puedes apostar por ti mismo ──
  if p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado';
  end if;

  -- ── Validaciones de entrada ──
  if p_monto is null or p_monto <= 0 then
    raise exception 'Monto inválido';
  end if;
  if p_tipo_apuesta not in ('ganador','diferencia_goles','resultado_exacto') then
    raise exception 'Tipo de apuesta inválido';
  end if;
  if p_tipo_apuesta = 'resultado_exacto' then
    if coalesce((p_prediccion->>'goles_local')::int, -1) not between 0 and 20
       or coalesce((p_prediccion->>'goles_visitante')::int, -1) not between 0 and 20 then
      raise exception 'Predicción fuera de rango (0-20)';
    end if;
  end if;

  -- ── TIME-LOCK: validación de ventana SERVER-SIDE ──
  -- Usa now() at time zone 'America/Caracas' — NO depende del reloj del cliente
  if now() < v_ventana_inicio then
    raise exception 'Los pronósticos para este partido aún no están disponibles. Se abren a las 00:00 del día anterior.';
  end if;
  if now() >= v_ventana_cierre then
    raise exception 'La ventana de pronósticos cerró a las 12:00 PM del día del partido.';
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

  -- ── Verificar que el partido sigue abierto en BD ──
  if not exists (
    select 1 from public.matches
    where id = v_match_id
      and apuestas_abiertas = true
      and estado = 'programado'
      and fecha_partido > now()
  ) then
    raise exception 'Este partido no acepta apuestas en este momento';
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
