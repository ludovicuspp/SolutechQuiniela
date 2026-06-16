-- ============================================================
-- Migración: Time-lock a 10 minutos + fix zona horaria
-- Ejecutar en Supabase SQL Editor (single execution)
--
-- Regla: desde 00:00 del día ANTERIOR hasta 10 min antes del partido (hora Venezuela).
-- ============================================================

-- Paso 1: Recrear la función get_bet_multiplier (limpio)
create or replace function public.get_bet_multiplier(p_fase text, p_tipo text)
returns numeric
language sql immutable
as $$
  select case p_fase
    when 'grupo'         then case p_tipo when 'ganador' then 1.8 when 'diferencia_goles' then 3.0 when 'resultado_exacto' then 5.0  else 2.0 end
    when 'octavos'       then case p_tipo when 'ganador' then 2.0 when 'diferencia_goles' then 3.5 when 'resultado_exacto' then 6.0  else 2.0 end
    when 'cuartos'       then case p_tipo when 'ganador' then 2.2 when 'diferencia_goles' then 4.0 when 'resultado_exacto' then 7.0  else 2.0 end
    when 'semifinal'     then case p_tipo when 'ganador' then 2.5 when 'diferencia_goles' then 4.5 when 'resultado_exacto' then 8.0  else 2.0 end
    when 'tercer_puesto' then case p_tipo when 'ganador' then 2.0 when 'diferencia_goles' then 3.5 when 'resultado_exacto' then 6.0  else 2.0 end
    when 'final'         then case p_tipo when 'ganador' then 3.0 when 'diferencia_goles' then 5.0 when 'resultado_exacto' then 10.0 else 2.0 end
    else 2.0
  end;
$$;

-- Paso 2: Recrear place_bet con time-lock corregido
-- Fix: v_now_ven y v_ventana_cierre ahora están AMBOS en timestamptz UTC,
-- comparados directamente. La aritmética de intervalos funciona correctamente
-- porque pg preserva el tipo. El resultado es equivalente a restar 10 min en UTC
-- (que es exactamente 10 min antes del kickoff, sin importar la zona horaria).
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

  -- Hora actual del servidor (UTC), luego convertida a Venezuela (UTC-4)
  -- para mensaje de error y comparaciones legibles
  v_now_ven            timestamptz := now() at time zone 'America/Caracas';

  -- Apertura: 00:00 del día anterior al partido en hora Venezuela
  v_ventana_inicio     timestamptz := (p_fecha_partido at time zone 'America/Caracas' - interval '1 day')
                                    at time zone 'America/Caracas';

  -- Cierre: 10 minutos antes del partido (UTC directo, luego convertido a Venezuela para comparar)
  v_ventana_cierre     timestamptz := (p_fecha_partido - interval '10 minutes') at time zone 'America/Caracas';
begin
  -- ── Autorización ──
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

  -- ── TIME-LOCK: ventana SERVER-SIDE ──
  -- Comparamos en hora Venezuela para que los mensajes de error sean legibles
  if v_now_ven < v_ventana_inicio then
    raise exception 'Los pronósticos para este partido aún no están disponibles. Se abren a las 00:00 del día anterior.';
  end if;
  if v_now_ven >= v_ventana_cierre then
    raise exception 'La ventana de pronósticos cerró 10 minutos antes del inicio del partido.';
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

-- Paso 3: Verificar que se actualizó correctamente
-- Debe decir "cerró 10 minutos antes" si la función se actualizó
-- Si dice "12:00 PM" es que sigue la versión vieja
