-- ============================================================
-- DIAGNÓSTICO: Logs descriptivos para el time-lock
-- Ejecutar en Supabase SQL Editor (single execution)
--
-- Después de ejecutar, cuando un usuario intente apostar y falle,
-- ve a Logs Explorer en Supabase y busca líneas con "IRONPLAY_DEBUG"
-- ============================================================

-- Recrear place_bet CON DIAGNÓSTICO
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

  v_now_ven            timestamptz := now() at time zone 'America/Caracas';
  v_ventana_inicio     timestamptz := (p_fecha_partido at time zone 'America/Caracas' - interval '1 day')
                                    at time zone 'America/Caracas';
  v_ventana_cierre     timestamptz := (p_fecha_partido - interval '10 minutes') at time zone 'America/Caracas';
begin
  -- ── DIAGNÓSTICO: loguear valores clave ──
  raise notice 'IRONPLAY_DEBUG | p_fecha_partido UTC: %', p_fecha_partido;
  raise notice 'IRONPLAY_DEBUG | v_now_ven (Venezuela): %', v_now_ven;
  raise notice 'IRONPLAY_DEBUG | v_ventana_inicio (Venezuela): %', v_ventana_inicio;
  raise notice 'IRONPLAY_DEBUG | v_ventana_cierre (Venezuela): %', v_ventana_cierre;
  raise notice 'IRONPLAY_DEBUG | Comparacion: now >= inicio? % | now < cierre? %', v_now_ven >= v_ventana_inicio, v_now_ven < v_ventana_cierre;

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

  if v_now_ven < v_ventana_inicio then
    raise notice 'IRONPLAY_DEBUG | BLOQUEADO: antes de ventana_inicio';
    raise exception 'Los pronósticos para este partido aún no están disponibles. Se abren a las 00:00 del día anterior.';
  end if;
  if v_now_ven >= v_ventana_cierre then
    raise notice 'IRONPLAY_DEBUG | BLOQUEADO: después de ventana_cierre';
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
