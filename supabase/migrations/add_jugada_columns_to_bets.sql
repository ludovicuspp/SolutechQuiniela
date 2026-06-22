-- ============================================
-- Migración: Fase 2 reglas de negocio SolutechQuiniela
-- Añade columnas tipo_jugada, marcador_local, marcador_visitante a bets
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Nuevas columnas en bets
alter table public.bets
  add column if not exists tipo_jugada       text check (tipo_jugada in ('ganador', 'empate', 'resultado_exacto')),
  add column if not exists marcador_local    integer,
  add column if not exists marcador_visitante integer;

-- 2. Poblar tipo_jugada para filas existentes a partir del campo prediccion (JSONB)
--    - prediccion->>'resultado' = 'empate'        → 'empate'
--    - tipo_apuesta = 'resultado_exacto'           → 'resultado_exacto'
--    - resto                                       → 'ganador'
update public.bets
set tipo_jugada =
  case
    when tipo_apuesta = 'resultado_exacto'          then 'resultado_exacto'
    when prediccion->>'resultado' = 'empate'        then 'empate'
    else 'ganador'
  end
where tipo_jugada is null;

-- 3. Poblar marcador_local / marcador_visitante para resultados exactos existentes
update public.bets
set
  marcador_local     = (prediccion->>'goles_local')::integer,
  marcador_visitante = (prediccion->>'goles_visitante')::integer
where tipo_apuesta = 'resultado_exacto'
  and prediccion->>'goles_local' is not null
  and prediccion->>'goles_visitante' is not null;

-- 4. Índice útil para consultas por tipo de jugada
create index if not exists idx_bets_tipo_jugada on public.bets(tipo_jugada);
