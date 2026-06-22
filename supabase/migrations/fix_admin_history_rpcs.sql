-- ============================================================
-- fix_admin_history_rpcs.sql
-- Admin ve historial de apuestas + movimientos de cualquier usuario.
-- SECURITY DEFINER + is_admin() gating (cierra hueco RLS).
-- ============================================================

-- 1) public_admin_get_user_bets: apuestas con datos del partido
create or replace function public.public_admin_get_user_bets(p_user_id uuid)
returns table (
  bet_id          uuid,
  match_id        uuid,
  external_id     integer,
  tipo_apuesta    text,
  prediccion      jsonb,
  monto           numeric,
  multiplicador   numeric,
  ganancia_potencial numeric,
  estado          text,
  created_at      timestamptz,
  -- partido
  equipo_local    text,
  equipo_visitante text,
  goles_local     integer,
  goles_visitante integer,
  match_estado    text,
  fecha_partido   timestamptz
)
language plpgsql security definer
as $$
begin
  -- Verificar que el llamador es admin
  if not public.is_admin() then
    raise exception 'Acceso denegado: solo administradores';
  end if;

  return query
  select
    b.id                             as bet_id,
    b.match_id,
    b.match_external_id              as external_id,
    b.tipo_apuesta,
    b.prediccion,
    b.monto,
    b.multiplicador,
    b.ganancia_potencial,
    b.estado,
    b.created_at,
    m.equipo_local,
    m.equipo_visitante,
    m.goles_local,
    m.goles_visitante,
    m.estado                         as match_estado,
    m.fecha_partido
  from public.bets b
  join public.matches m on m.id = b.match_id
  where b.user_id = p_user_id
  order by b.created_at desc
  limit 100;
end;
$$;

grant execute on function public.public_admin_get_user_bets(uuid) to authenticated;

-- 2) Agregar is_admin() a public_admin_get_user_transactions (ya existe, recrear con gating)
create or replace function public.public_admin_get_user_transactions(p_user_id uuid)
returns table (
  id              uuid,
  tipo            text,
  monto           numeric,
  balance_despues numeric,
  descripcion     text,
  referencia      text,
  created_at      timestamptz
)
language plpgsql security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'Acceso denegado: solo administradores';
  end if;

  return query
  select
    t.id,
    t.tipo,
    t.monto,
    t.balance_despues,
    t.descripcion,
    t.referencia,
    t.created_at
  from public.wallet_transactions t
  where t.user_id = p_user_id
  order by t.created_at desc
  limit 100;
end;
$$;

grant execute on function public.public_admin_get_user_transactions(uuid) to authenticated;

-- Forzar recarga del caché de PostgREST
notify pgrst, 'reload schema';
