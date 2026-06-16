-- ============================================
-- Migración: Alias de usuario + rebranding IronPlay
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Añadir columna alias a la tabla users
alter table public.users
  add column if not exists alias text;

-- 2. Poblar alias con el primer nombre de cada usuario (fallback inicial)
update public.users
set alias = split_part(nombre, ' ', 1)
where alias is null or alias = '';

-- 3. Recrear la vista leaderboard incluyendo alias
--    DROP primero para evitar el error "cannot change name of view column"
drop view if exists public.leaderboard;

create view public.leaderboard as
select
  u.id,
  u.nombre,
  u.alias,
  u.empresa,
  w.balance,
  w.total_earned,
  w.total_won,
  w.total_wagered,
  (select count(*) from public.bets b where b.user_id = u.id and b.estado = 'ganada')::integer as apuestas_ganadas,
  (select count(*) from public.bets b where b.user_id = u.id)::integer as total_apuestas,
  rank() over (order by (w.balance + w.total_won) desc)::integer as posicion
from public.users u
join public.wallets w on w.user_id = u.id
where u.is_admin is not true
order by (w.balance + w.total_won) desc;

grant select on public.leaderboard to anon, authenticated;

-- 4. Recrear la vista prize_winners_detail incluyendo alias del usuario
drop view if exists public.prize_winners_detail;

create view public.prize_winners_detail as
select
  pw.id,
  pw.fase,
  pw.posicion,
  pw.claimed_at,
  pw.created_at,
  u.alias        as usuario_alias,
  u.nombre       as usuario_nombre,
  u.empresa      as usuario_empresa,
  pw.user_id,
  p.titulo       as premio_titulo,
  p.descripcion  as premio_descripcion,
  pw.prize_id
from public.prize_winners pw
left join public.users   u on u.id = pw.user_id
left join public.prizes  p on p.id = pw.prize_id
order by pw.fase, pw.posicion;
