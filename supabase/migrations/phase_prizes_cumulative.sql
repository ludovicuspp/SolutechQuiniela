-- ============================================
-- Cumulative phase ranking + dieciseisavos support
-- Reemplaza get_phase_ranking para ranking ACUMULADO
-- (suma puntos de todos los partidos con ordinal <= fase objetivo)
-- ============================================

drop function if exists public.fase_ordinal(text);

-- Helper: ordinal de cada fase para ranking acumulado
create or replace function public.fase_ordinal(p_fase text)
returns integer as $$
begin
  return case p_fase
    when 'grupo'         then 1
    when 'repechaje'     then 1  -- play-off round of 32, mismo cutoff que grupo
    when 'dieciseisavos' then 2
    when 'octavos'        then 3
    when 'cuartos'        then 4
    when 'semifinal'      then 5
    when 'tercer_puesto' then 6
    when 'final'         then 7
    else 0
  end;
end;
$$ language plpgsql security definer;

-- ============================================
-- FUNCIÓN: Ranking ACUMULADO de una fase
-- Suma puntos de TODOS los partidos con ordinal <= fase objetivo
-- ============================================
create or replace function public.get_phase_ranking(p_fase text)
returns table (
  user_id  uuid,
  nombre   text,
  empresa  text,
  puntos   numeric,
  posicion integer
) as $$
declare
  v_ord integer;
begin
  v_ord := public.fase_ordinal(p_fase);

  return query
  select
    sub.uid,
    sub.u_nombre,
    sub.u_empresa,
    sub.total_puntos,
    row_number() over (order by sub.total_puntos desc)::integer
  from (
    select
      u.id                                  as uid,
      u.nombre                              as u_nombre,
      u.empresa                             as u_empresa,
      coalesce(sum(b.ganancia_real), 0)     as total_puntos
    from public.users u
    left join public.bets b
      on b.user_id = u.id
      and b.estado = 'ganada'
      and exists (
        select 1 from public.matches m
        where m.id = b.match_id
          and public.fase_ordinal(m.fase) <= v_ord
      )
    where u.is_admin is not true
    group by u.id, u.nombre, u.empresa
  ) sub
  order by sub.total_puntos desc;
end;
$$ language plpgsql security definer;

-- assign_phase_prizes no necesita cambios (ya llama get_phase_ranking)
