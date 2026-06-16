-- ============================================================
-- IronBet — Bundle de funciones faltantes en producción
-- Run this in Supabase SQL Editor (single execution)
--
-- Incluye todas las funciones definidas en schema.sql que no
-- están cubiertas por migraciones previas:
--   - admin_create_user
--   - auto_resolve_bets_on_match_end + trigger
--   - get_phase_ranking
--   - assign_phase_prizes
--   - prize_winners_detail (view)
--   - register_profile
--   - rif_exists
--   - admin_broadcast_notification
-- ============================================================

-- ============================================================
-- HELPER: verificar si el usuario actual es admin
-- (dependencia de admin_broadcast_notification y otras)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (select 1 from public.users where id = auth.uid() and is_admin = true);
$$;

-- ============================================================
-- ADMIN: crear usuario completo desde panel
-- ============================================================
create or replace function public.admin_create_user(
  p_email    text,
  p_password text,
  p_rif      text,
  p_nombre   text,
  p_telefono text default '',
  p_zona     text default '',
  p_vendedor text default '',
  p_empresa  text default '',
  p_puntos   numeric default 0,
  p_is_admin boolean default false
) returns uuid as $$
declare
  v_user_id   uuid;
  v_wallet_id uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  select id into v_user_id from auth.users where email = p_email limit 1;
  if v_user_id is null then
    v_user_id := extensions.uuid_generate_v4();
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
    values (v_user_id, p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(), jsonb_build_object('nombre', p_nombre, 'rif', p_rif), 'authenticated', 'authenticated', now(), now());
  end if;
  insert into public.users (id, rif, nombre, telefono, zona, vendedor, empresa, telefono_verificado, is_admin)
  values (v_user_id, p_rif, p_nombre, p_telefono, p_zona, p_vendedor, p_empresa, true, p_is_admin)
  on conflict (id) do nothing;
  insert into public.wallets (user_id, balance, total_earned) values (v_user_id, p_puntos, p_puntos) on conflict (user_id) do nothing;
  if p_puntos > 0 then
    select id into v_wallet_id from public.wallets where user_id = v_user_id;
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_user_id, 'compra', p_puntos, p_puntos, 'Puntos iniciales por administrador', 'admin_created');
  end if;
  return v_user_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- TRIGGER: resolver apuestas automáticamente al finalizar partido
-- ============================================================
create or replace function public.auto_resolve_bets_on_match_end() returns trigger as $$
begin
  if new.estado = 'finalizado' and not new.resultado_verificado then
    perform public.resolve_match_bets(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_auto_resolve_bets on public.matches;
create trigger trigger_auto_resolve_bets
  after update on public.matches
  for each row
  execute function public.auto_resolve_bets_on_match_end();

-- ============================================================
-- FUNCIÓN: Ranking de una fase
-- ============================================================
create or replace function public.get_phase_ranking(p_fase text)
returns table (
  user_id  uuid,
  nombre   text,
  empresa  text,
  puntos   numeric,
  posicion integer
) as $$
begin
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
          and m.fase = p_fase
      )
    where u.is_admin is not true
    group by u.id, u.nombre, u.empresa
  ) sub
  order by sub.total_puntos desc;
end;
$$ language plpgsql security definer;

-- ============================================================
-- FUNCIÓN: Asignar premios top 3 de una fase
-- ============================================================
create or replace function public.assign_phase_prizes(p_fase text)
returns void as $$
declare
  v_ranking record;
  v_prize   record;
  v_pos     integer;
begin
  delete from public.prize_winners where fase = p_fase;

  for v_ranking in
    select * from public.get_phase_ranking(p_fase) limit 3
  loop
    v_pos := v_ranking.posicion;

    select * into v_prize
    from public.prizes
    where fase = p_fase and posicion = v_pos
    limit 1;

    insert into public.prize_winners (id, prize_id, user_id, fase, posicion, created_at)
    values (
      gen_random_uuid(),
      v_prize.id,
      v_ranking.user_id,
      p_fase,
      v_pos,
      now()
    );

    insert into public.notifications (user_id, titulo, mensaje, tipo, data)
    values (
      v_ranking.user_id,
      case v_pos
        when 1 then '🥇 ¡Ganaste el 1er Premio!'
        when 2 then '🥈 ¡Ganaste el 2do Premio!'
        when 3 then '🥉 ¡Ganaste el 3er Premio!'
      end,
      case
        when v_prize.id is not null then
          'Felicitaciones! Ganaste el premio "' || v_prize.titulo || '" en la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
        else
          'Felicitaciones! Quedaste en la posicion ' || v_pos || ' de la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
      end,
      'success',
      jsonb_build_object(
        'fase', p_fase,
        'posicion', v_pos,
        'puntos', v_ranking.puntos,
        'prize_id', v_prize.id
      )
    );
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- VISTA: Ganadores con detalle de usuario y premio
-- ============================================================
drop view if exists public.prize_winners_detail;
create view public.prize_winners_detail as
select
  pw.id,
  pw.fase,
  pw.posicion,
  pw.claimed_at,
  pw.created_at,
  u.nombre      as usuario_nombre,
  u.empresa     as usuario_empresa,
  pw.user_id,
  p.titulo      as premio_titulo,
  p.descripcion as premio_descripcion,
  pw.prize_id
from public.prize_winners pw
left join public.users   u on u.id = pw.user_id
left join public.prizes  p on p.id = pw.prize_id
order by pw.fase, pw.posicion;

-- ============================================================
-- Registro atómico: perfil + wallet + transacción inicial
-- ============================================================
create or replace function public.register_profile(
  p_rif text,
  p_nombre text,
  p_telefono text,
  p_email text default '',
  p_alias text default '',
  p_empresa text default '',
  p_zona text default '',
  p_vendedor text default '',
  p_puntos numeric default 0
) returns void as $$
declare
  v_uid uuid;
  v_wallet_id uuid;
  v_alias text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Sesión requerida para registrar el perfil';
  end if;

  v_alias := coalesce(nullif(p_alias, ''), split_part(p_nombre, ' ', 1));

  insert into public.users (id, rif, nombre, telefono, telefono_verificado, email, alias, empresa, zona, vendedor)
  values (
    v_uid,
    p_rif,
    p_nombre,
    p_telefono,
    true,
    nullif(coalesce(p_email, ''), ''),
    v_alias,
    coalesce(p_empresa, ''),
    coalesce(p_zona, ''),
    coalesce(p_vendedor, '')
  );

  insert into public.wallets (user_id, balance, total_earned)
  values (v_uid, coalesce(p_puntos,0), coalesce(p_puntos,0))
  returning id into v_wallet_id;

  if coalesce(p_puntos,0) > 0 then
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_uid, 'compra', p_puntos, p_puntos, 'Puntos iniciales por compras anteriores', 'registro_inicial');
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Verificación de RIF en registro (sin exponer la tabla users)
-- ============================================================
create or replace function public.rif_exists(p_rif text, p_codigo text default null)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.users
    where rif = p_rif or (p_codigo is not null and rif = p_codigo)
  );
$$;
grant execute on function public.rif_exists(text, text) to anon, authenticated;

-- ============================================================
-- Broadcast de notificación global (sólo admin)
-- Parámetros en orden alfabético para que PostgREST resuelva
-- correctamente el overload al llamar por nombre de parámetro.
-- ============================================================
-- Eliminar versión anterior con firma distinta si existe
drop function if exists public.admin_broadcast_notification(text, text, text);

create or replace function public.admin_broadcast_notification(
  p_mensaje text,
  p_tipo    text default 'info',
  p_titulo  text default ''
) returns integer as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  insert into public.notifications (user_id, titulo, mensaje, tipo, leida)
  select id, p_titulo, p_mensaje, p_tipo, false from public.users;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;
