-- Fix batch_upsert_matches: nullif(goles, 0) converts 0-0 score to null
-- 0-0 is a valid score, should not be nullified
create or replace function public.batch_upsert_matches(p_matches jsonb)
returns void
language plpgsql security definer
as $$
begin
  insert into public.matches (
    external_id, fase, grupo, jornada,
    equipo_local, equipo_visitante,
    codigo_local, codigo_visitante,
    bandera_local, bandera_visitante,
    sede, fecha_partido,
    goles_local, goles_visitante,
    estado, resultado_verificado, apuestas_abiertas
  )
  select
    (item->>'external_id')::int,
    item->>'fase',
    nullif(item->>'grupo', ''),
    nullif((item->>'jornada')::int, 0)::int,
    item->>'equipo_local',
    item->>'equipo_visitante',
    nullif(item->>'codigo_local', ''),
    nullif(item->>'codigo_visitante', ''),
    nullif(item->>'bandera_local', ''),
    nullif(item->>'bandera_visitante', ''),
    nullif(item->>'sede', ''),
    (item->>'fecha_partido')::timestamptz,
    (item->>'goles_local')::int,
    (item->>'goles_visitante')::int,
    item->>'estado',
    case when item->>'estado' = 'finalizado' then true else false end,
    case when item->>'estado' = 'programado' then true else false end
  from jsonb_array_elements(p_matches) as item
  on conflict (external_id) do update set
    fase = excluded.fase,
    grupo = excluded.grupo,
    jornada = excluded.jornada,
    equipo_local = excluded.equipo_local,
    equipo_visitante = excluded.equipo_visitante,
    codigo_local = excluded.codigo_local,
    codigo_visitante = excluded.codigo_visitante,
    bandera_local = excluded.bandera_local,
    bandera_visitante = excluded.bandera_visitante,
    sede = excluded.sede,
    fecha_partido = excluded.fecha_partido,
    goles_local = excluded.goles_local,
    goles_visitante = excluded.goles_visitante,
    estado = excluded.estado,
    resultado_verificado = excluded.resultado_verificado,
    apuestas_abiertas = excluded.apuestas_abiertas,
    updated_at = now();
end;
$$;
