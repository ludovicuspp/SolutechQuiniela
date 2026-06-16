-- ============================================================
-- FIX DEFINITIVO: Time-lock 10 min - bug de zona horaria corregido
-- Ejecutar en Supabase SQL Editor (single execution)
--
-- Bug original: p_fecha_partido llega en UTC (de matches.fecha_partido)
-- pero v_ventana_cierre usaba AT TIME ZONE, re-interpretando
-- el UTC como hora Venezuela → cierre corrido 4h.
--
-- Fix: v_ventana_cierre se calcula directamente de p_fecha_partido
-- en UTC, sin conversión. v_now_ven se convierte a UTC para comparar
-- ambos valores en la misma zona (UTC).
-- La comparación se hace en UTC (universal), los mensajes de error
-- se muestran en Venezuela (legible para el usuario).
-- ============================================================

drop function if exists public.get_bet_multiplier(text, text);
create function public.get_bet_multiplier(p_fase text, p_tipo text)
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

drop function if exists public.place_bet(uuid, integer, text, jsonb, numeric, text, text, integer, text, text, text, text, text, text, text, timestamptz);
create function public.place_bet(
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

  -- Hora actual del servidor en UTC
  v_now_utc            timestamptz := now();

  -- v_ventana_inicio: abierto 1 día antes del partido (en hora Venezuela)
  -- Convertimos p_fecha_partido (UTC) → Venezuela, restamos 1 día, convertimos a UTC
  v_ventana_inicio     timestamptz := (p_fecha_partido at time zone 'America/Caracas' - interval '1 day')
                                    at time zone 'UTC';

  -- v_ventana_cierre: exactamente 10 min antes del partido
  -- p_fecha_partido YA ESTÁ en UTC → restamos 10 min directamente (sin AT TIME ZONE)
  v_ventana_cierre     timestamptz := p_fecha_partido - interval '10 minutes';

  -- Para mensajes de error legibles: hora actual y límite en Venezuela
  v_now_ven            timestamptz := now() at time zone 'America/Caracas';
  v_cierre_ven         timestamptz := v_ventana_cierre at time zone 'America/Caracas';
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado';
  end if;

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

  -- Comparación en UTC (universal, sin ambigüedad de zona horaria)
  if v_now_utc < v_ventana_inicio then
    raise exception 'Los pronósticos para este partido aún no están disponibles. Se abren a las 00:00 del día anterior.';
  end if;
  if v_now_utc >= v_ventana_cierre then
    raise exception 'La ventana de pronósticos cerró 10 minutos antes del inicio del partido.';
  end if;

  v_multiplicador := public.get_bet_multiplier(p_fase, p_tipo_apuesta);

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

  if exists (select 1 from public.bets where user_id = p_user_id and match_id = v_match_id) then
    raise exception 'Ya tienes una apuesta en este partido';
  end if;

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

  if not exists (
    select 1 from public.matches
    where id = v_match_id
      and estado = 'programado'
  ) then
    raise exception 'Este partido no está disponible para pronosticar';
  end if;

  v_ganancia_potencial := p_monto * v_multiplicador;

  update public.wallets
  set balance       = balance - p_monto,
      total_wagered = total_wagered + p_monto,
      updated_at    = now()
  where id = v_wallet_id;

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

  insert into public.wallet_transactions (
    wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia
  ) values (
    v_wallet_id, p_user_id, 'apuesta', -p_monto, v_balance - p_monto,
    'Pronóstico en partido', v_bet_id::text
  );

  return v_bet_id;
end;
$$ language plpgsql security definer;
