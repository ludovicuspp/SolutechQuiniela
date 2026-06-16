-- ============================================================
-- VERIFICACIÓN RÁPIDA: ¿Está la función actualizada?
-- Ejecutar en SQL Editor y pegar el resultado
-- ============================================================

-- 1. Ver el código fuente actual de place_bet
select proname, prosrc from pg_proc
where proname = 'place_bet'
and pronamespace = (select oid from pg_namespace where nspname = 'public');

-- 2. Probar la función directamente (va a fallar con los valores correctos
--    pero los RAISE NOTICE van a aparecer en Logs Explorer)
do $$
declare
  resultado uuid;
  v_now_ven            timestamptz := now() at time zone 'America/Caracas';
  v_testPartido        timestamptz := '2026-06-12 02:00:00+00'; -- partido a las 10PM VEN (2AM UTC next day)
  v_ventana_inicio     timestamptz := (v_testPartido at time zone 'America/Caracas' - interval '1 day') at time zone 'America/Caracas';
  v_ventana_cierre     timestamptz := (v_testPartido - interval '10 minutes') at time zone 'America/Caracas';
begin
  raise notice '=== DIAGNOSTICO MANUAL ===';
  raise notice 'now() at time zone America/Caracas (v_now_ven): %', v_now_ven;
  raise notice 'partido UTC (input): %', v_testPartido;
  raise notice 'partido en hora Venezuela: %', v_testPartido at time zone 'America/Caracas';
  raise notice 'ventana_inicio (Venezuela): %', v_ventana_inicio;
  raise notice 'ventana_cierre (Venezuela): %', v_ventana_cierre;
  raise notice 'Comparacion: now >= inicio? % | now < cierre? %', v_now_ven >= v_ventana_inicio, v_now_ven < v_ventana_cierre;
  raise notice '=== FIN DIAGNOSTICO ===';
end;
$$;
