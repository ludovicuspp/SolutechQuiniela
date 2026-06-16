-- ============================================
-- IronMundial 2026 - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================
-- HELPER: is_admin() — SECURITY DEFINER evita recursión RLS
-- (debe existir antes de las políticas que lo usan)
-- ============================================
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (select 1 from public.users where id = auth.uid() and is_admin = true);
$$;

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  rif text unique not null,
  nombre text not null,
  telefono text not null,
  telefono_verificado boolean default false,
  email text,
  alias text,
  empresa text,
  zona text,
  vendedor text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can read own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own data" on public.users
  for update using (auth.uid() = id);

-- Admins pueden leer todos los usuarios (usa is_admin() para evitar recursión RLS)
create policy "Admins read all users" on public.users
  for select to authenticated using (public.is_admin());
-- NOTA: el ranking público se sirve por la vista public.leaderboard (no expone PII).
-- INSERT de usuarios se realiza vía RPC register_profile() / admin_create_user() (SECURITY DEFINER).

-- ============================================
-- WALLETS
-- ============================================
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique not null,
  balance numeric(12,2) default 0 check (balance >= 0),
  total_earned numeric(12,2) default 0,
  total_wagered numeric(12,2) default 0,
  total_won numeric(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.wallets enable row level security;

create policy "Users can read own wallet" on public.wallets
  for select using (auth.uid() = user_id);

create policy "Users can read all wallets for leaderboard" on public.wallets
  for select using (true);

-- Escritura de wallets SOLO vía RPC SECURITY DEFINER (place_bet, add_purchase_points,
-- register_profile, admin_create_user). Sin policy de escritura para clientes.

-- ============================================
-- WALLET TRANSACTIONS
-- ============================================
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.wallets(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  tipo text not null check (tipo in ('compra', 'apuesta', 'ganancia', 'reembolso')),
  monto numeric(12,2) not null,
  balance_despues numeric(12,2) not null,
  descripcion text,
  referencia text,
  created_at timestamptz default now()
);

alter table public.wallet_transactions enable row level security;

create policy "Users can read own transactions" on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- Escritura de transacciones SOLO vía RPC SECURITY DEFINER.

-- ============================================
-- MATCHES (World Cup 2026)
-- ============================================
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  external_id integer unique,
  fase text not null check (fase in ('grupo', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final')),
  grupo text,
  jornada integer,
  equipo_local text not null,
  equipo_visitante text not null,
  codigo_local text,
  codigo_visitante text,
  bandera_local text,
  bandera_visitante text,
  sede text,
  fecha_partido timestamptz not null,
  goles_local integer,
  goles_visitante integer,
  estado text default 'programado' check (estado in ('programado', 'en_juego', 'finalizado', 'suspendido', 'pospuesto')),
  resultado_verificado boolean default false,
  apuestas_abiertas boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.matches enable row level security;

create policy "Anyone can read matches" on public.matches
  for select using (true);

-- Escritura de matches SOLO para administradores (sync desde el panel)
create policy "Admins manage matches" on public.matches
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================
-- BETS (Apuestas)
-- ============================================
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade,
  match_external_id integer,
  tipo_apuesta text not null check (tipo_apuesta in ('ganador', 'diferencia_goles', 'resultado_exacto')),
  prediccion jsonb not null,
  monto numeric(12,2) not null check (monto > 0),
  multiplicador numeric(5,2) not null,
  ganancia_potencial numeric(12,2) not null,
  estado text default 'pendiente' check (estado in ('pendiente', 'ganada', 'perdida', 'reembolsada')),
  ganancia_real numeric(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bets enable row level security;

create policy "Users can read own bets" on public.bets
  for select using (auth.uid() = user_id);

-- INSERT de apuestas SOLO vía place_bet() (SECURITY DEFINER). Sin policy de escritura
-- para clientes: evita que se inserten apuestas con multiplicador/ganancia manipulados.

-- ============================================
-- PROCESSED DOCUMENTS (avoid double-counting ERP purchases)
-- ============================================
create table public.processed_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  numero_documento text not null,
  tipo_documento text not null,
  monto_usd numeric(12,2) not null,
  puntos_otorgados numeric(12,2) not null,
  fecha_documento timestamptz,
  created_at timestamptz default now(),
  unique(user_id, numero_documento, tipo_documento)
);

alter table public.processed_documents enable row level security;

create policy "Users can read own documents" on public.processed_documents
  for select using (auth.uid() = user_id);

create policy "Service role manages documents" on public.processed_documents
  for all using (true);

-- ============================================
-- VERIFICATION CODES (SMS)
-- ============================================
create table public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  codigo text not null,
  usado boolean default false,
  expira_en timestamptz not null,
  created_at timestamptz default now()
);

alter table public.verification_codes enable row level security;

create policy "Service role manages codes" on public.verification_codes
  for all using (true);

-- ============================================
-- PRIZES (IronBet phases)
-- ============================================
create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  fase text not null,
  posicion integer not null check (posicion >= 1),
  titulo text not null,
  descripcion text,
  created_at timestamptz default now()
);

alter table public.prizes enable row level security;

create policy "Anyone can read prizes" on public.prizes
  for select using (true);

create policy "Admins can manage prizes" on public.prizes
  for all using (public.is_admin());

-- ============================================
-- NOTIFICATIONS
-- ============================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  titulo text not null,
  mensaje text not null,
  tipo text default 'info' check (tipo in ('info', 'success', 'warning', 'bet_result')),
  leida boolean default false,
  data jsonb,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

-- INSERT de notificaciones SOLO vía RPC SECURITY DEFINER
-- (place_bet, resolve_match_bets, assign_phase_prizes, admin_broadcast_notification).

-- ============================================
-- INDEXES
-- ============================================
create index idx_bets_user on public.bets(user_id);
create index idx_bets_match on public.bets(match_id);
create index idx_bets_estado on public.bets(estado);
create index idx_matches_fecha on public.matches(fecha_partido);
create index idx_matches_estado on public.matches(estado);
create index idx_wallet_tx_wallet on public.wallet_transactions(wallet_id);
create index idx_wallet_tx_user on public.wallet_transactions(user_id);
create index idx_notifications_user on public.notifications(user_id, leida);
create index idx_processed_docs_user on public.processed_documents(user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Place a bet (atomic: upsert match + deduct balance + create bet)
-- Multiplicador calculado server-side; valida autorización, monto, rango y duplicado.
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
  v_wallet_id uuid;
  v_balance numeric;
  v_bet_id uuid;
  v_multiplicador numeric;
  v_ganancia_potencial numeric;
  v_match_id uuid;
begin
  -- Autorización: sólo puedes apostar por ti mismo
  if p_user_id is distinct from auth.uid() then
    raise exception 'No autorizado';
  end if;

  -- Validaciones de entrada
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

  -- Multiplicador AUTORITATIVO (server-side)
  v_multiplicador := public.get_bet_multiplier(p_fase, p_tipo_apuesta);

  -- Upsert match from API data (idempotente — safe to call multiple times)
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
    updated_at = now()
  returning id into v_match_id;

  -- Anti-duplicado (1 apuesta por partido)
  if exists (select 1 from public.bets where user_id = p_user_id and match_id = v_match_id) then
    raise exception 'Ya tienes una apuesta en este partido';
  end if;

  -- Get wallet and check balance
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

  -- Check match is open for bets
  if not exists (
    select 1 from public.matches
    where id = v_match_id
    and apuestas_abiertas = true
    and estado = 'programado'
    and fecha_partido > now()
  ) then
    raise exception 'Este partido no acepta apuestas en este momento';
  end if;

  v_ganancia_potencial := p_monto * v_multiplicador;

  -- Deduct from wallet
  update public.wallets
  set balance = balance - p_monto,
      total_wagered = total_wagered + p_monto,
      updated_at = now()
  where id = v_wallet_id;

  -- Create bet
  insert into public.bets (user_id, match_id, match_external_id, tipo_apuesta, prediccion, monto, multiplicador, ganancia_potencial)
  values (p_user_id, v_match_id, p_external_id, p_tipo_apuesta, p_prediccion, p_monto, v_multiplicador, v_ganancia_potencial)
  returning id into v_bet_id;

  -- Log transaction
  insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
  values (v_wallet_id, p_user_id, 'apuesta', -p_monto, v_balance - p_monto, 'Apuesta en partido', v_bet_id::text);

  return v_bet_id;
end;
$$ language plpgsql security definer;

-- Multiplicador autoritativo por fase + tipo de apuesta
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

-- Add points from purchase
create or replace function public.add_purchase_points(
  p_user_id uuid,
  p_monto_usd numeric,
  p_numero_doc text,
  p_tipo_doc text,
  p_fecha_doc timestamptz
) returns void as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  -- Check document not already processed
  if exists (
    select 1 from public.processed_documents
    where user_id = p_user_id
    and numero_documento = p_numero_doc
    and tipo_documento = p_tipo_doc
  ) then
    return;
  end if;

  -- Get wallet
  select id into v_wallet_id
  from public.wallets
  where user_id = p_user_id
  for update;

  -- Update wallet
  update public.wallets
  set balance = balance + p_monto_usd,
      total_earned = total_earned + p_monto_usd,
      updated_at = now()
  where id = v_wallet_id
  returning balance into v_new_balance;

  -- Record processed document
  insert into public.processed_documents (user_id, numero_documento, tipo_documento, monto_usd, puntos_otorgados, fecha_documento)
  values (p_user_id, p_numero_doc, p_tipo_doc, p_monto_usd, p_monto_usd, p_fecha_doc);

  -- Log transaction
  insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
  values (v_wallet_id, p_user_id, 'compra', p_monto_usd, v_new_balance,
    'Puntos por ' || p_tipo_doc || ' #' || p_numero_doc, p_numero_doc);
end;
$$ language plpgsql security definer;

-- Resolve bet results for a match
create or replace function public.resolve_match_bets(
  p_match_id uuid
) returns void as $$
declare
  v_match record;
  v_bet record;
  v_won boolean;
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  select * into v_match from public.matches where id = p_match_id and estado = 'finalizado';
  if not found then
    raise exception 'Partido no encontrado o no finalizado';
  end if;

  for v_bet in
    select * from public.bets
    where match_id = p_match_id and estado = 'pendiente'
  loop
    v_won := false;

    if v_bet.tipo_apuesta = 'ganador' then
      if v_match.goles_local > v_match.goles_visitante and v_bet.prediccion->>'resultado' = 'local' then
        v_won := true;
      elsif v_match.goles_visitante > v_match.goles_local and v_bet.prediccion->>'resultado' = 'visitante' then
        v_won := true;
      elsif v_match.goles_local = v_match.goles_visitante and v_bet.prediccion->>'resultado' = 'empate' then
        v_won := true;
      end if;

    elsif v_bet.tipo_apuesta = 'diferencia_goles' then
      declare
        v_diff integer := abs(v_match.goles_local - v_match.goles_visitante);
        v_pred_diff integer := (v_bet.prediccion->>'diferencia')::integer;
        v_pred_favor text := v_bet.prediccion->>'favor';
        v_real_favor text;
      begin
        if v_match.goles_local > v_match.goles_visitante then v_real_favor := 'local';
        elsif v_match.goles_visitante > v_match.goles_local then v_real_favor := 'visitante';
        else v_real_favor := 'empate';
        end if;

        if v_diff = v_pred_diff and v_real_favor = v_pred_favor then
          v_won := true;
        end if;
      end;

    elsif v_bet.tipo_apuesta = 'resultado_exacto' then
      if v_match.goles_local = (v_bet.prediccion->>'goles_local')::integer
        and v_match.goles_visitante = (v_bet.prediccion->>'goles_visitante')::integer then
        v_won := true;
      end if;
    end if;

    if v_won then
      select id into v_wallet_id from public.wallets where user_id = v_bet.user_id;

      update public.wallets
      set balance = balance + v_bet.ganancia_potencial,
          total_won = total_won + v_bet.ganancia_potencial,
          updated_at = now()
      where user_id = v_bet.user_id
      returning balance into v_new_balance;

      update public.bets
      set estado = 'ganada', ganancia_real = v_bet.ganancia_potencial, updated_at = now()
      where id = v_bet.id;

      insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
      values (v_wallet_id, v_bet.user_id, 'ganancia', v_bet.ganancia_potencial, v_new_balance,
        'Ganancia apuesta - ' || v_bet.tipo_apuesta, v_bet.id::text);

      insert into public.notifications (user_id, titulo, mensaje, tipo, data)
      values (v_bet.user_id,
        'Apuesta ganada!',
        'Ganaste ' || v_bet.ganancia_potencial || ' puntos en tu apuesta de ' || v_bet.tipo_apuesta,
        'bet_result',
        jsonb_build_object('bet_id', v_bet.id, 'won', true, 'amount', v_bet.ganancia_potencial));
    else
      update public.bets
      set estado = 'perdida', updated_at = now()
      where id = v_bet.id;

      insert into public.notifications (user_id, titulo, mensaje, tipo, data)
      values (v_bet.user_id,
        'Apuesta perdida',
        'Tu apuesta de ' || v_bet.tipo_apuesta || ' por ' || v_bet.monto || ' puntos no acerto',
        'bet_result',
        jsonb_build_object('bet_id', v_bet.id, 'won', false, 'amount', v_bet.monto));
    end if;
  end loop;

  update public.matches set resultado_verificado = true where id = p_match_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- LEADERBOARD VIEW
-- ============================================
create or replace view public.leaderboard as
select
  u.id,
  u.nombre,
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

-- ============================================
-- UPSERT MATCH (from football-data.org API sync)
-- ============================================
create or replace function public.upsert_match(
  p_external_id integer,
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
  p_fecha_partido timestamptz,
  p_goles_local integer,
  p_goles_visitante integer,
  p_estado text
) returns void as $$
begin
  insert into public.matches (
    external_id, fase, grupo, jornada,
    equipo_local, equipo_visitante,
    codigo_local, codigo_visitante,
    bandera_local, bandera_visitante,
    sede, fecha_partido,
    goles_local, goles_visitante,
    estado,
    resultado_verificado,
    apuestas_abiertas
  ) values (
    p_external_id, p_fase, p_grupo, p_jornada,
    p_equipo_local, p_equipo_visitante,
    p_codigo_local, p_codigo_visitante,
    p_bandera_local, p_bandera_visitante,
    p_sede, p_fecha_partido,
    p_goles_local, p_goles_visitante,
    p_estado,
    case when p_estado = 'finalizado' then true else false end,
    case when p_estado = 'programado' then true else false end
  )
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
    resultado_verificado = case when excluded.estado = 'finalizado' then true else public.matches.resultado_verificado end,
    apuestas_abiertas = case when excluded.estado = 'programado' then true else false end,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- ============================================
-- RESOLVE MATCH BY EXTERNAL ID
-- Fetches score from football-data.org API, saves to Supabase, resolves bets
-- ============================================
create or replace function public.resolve_match_by_external_id(
  p_external_id integer,
  p_goles_local integer,
  p_goles_visitante integer,
  p_estado text
) returns void as $$
declare
  v_match_id uuid;
begin
  -- Sólo admin: evita inyección de marcadores falsos desde clientes
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select id into v_match_id from public.matches where external_id = p_external_id;
  if not found then
    raise exception 'Match not found: %', p_external_id;
  end if;

  update public.matches set
    goles_local = p_goles_local,
    goles_visitante = p_goles_visitante,
    estado = p_estado,
    resultado_verificado = case when p_estado = 'finalizado' then true else false end,
    apuestas_abiertas = case when p_estado = 'programado' then true else false end,
    updated_at = now()
  where id = v_match_id;

  if p_estado = 'finalizado' then
    perform resolve_match_bets(v_match_id);
  end if;
end;
$$ language plpgsql security definer;

-- ============================================
-- UPSERT MATCH FROM API (creates match if not exists)
-- Used when a match ends and we need to save its score
-- ============================================
create or replace function public.upsert_match_from_api(
  p_external_id integer,
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
  p_fecha_partido timestamptz,
  p_goles_local integer,
  p_goles_visitante integer,
  p_estado text
) returns void as $$
begin
  insert into public.matches (
    external_id, fase, grupo, jornada,
    equipo_local, equipo_visitante,
    codigo_local, codigo_visitante,
    bandera_local, bandera_visitante,
    sede, fecha_partido,
    goles_local, goles_visitante,
    estado,
    resultado_verificado,
    apuestas_abiertas
  ) values (
    p_external_id, p_fase, p_grupo, p_jornada,
    p_equipo_local, p_equipo_visitante,
    p_codigo_local, p_codigo_visitante,
    p_bandera_local, p_bandera_visitante,
    p_sede, p_fecha_partido,
    p_goles_local, p_goles_visitante,
    p_estado,
    case when p_estado = 'finalizado' then true else false end,
    case when p_estado = 'programado' then true else false end
  )
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
    resultado_verificado = case when excluded.estado = 'finalizado' then true else public.matches.resultado_verificado end,
    apuestas_abiertas = case when excluded.estado = 'programado' then true else false end,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- ============================================
-- ADMIN: crear usuario desde el panel
-- ============================================
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

-- ============================================
-- ADMIN: eliminar usuario completo
-- ============================================
create or replace function public.admin_delete_user(p_user_id uuid) returns void as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  delete from public.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- TRIGGER: Resolver automáticamente apuestas cuando partido finaliza
-- ============================================
create or replace function public.auto_resolve_bets_on_match_end() returns trigger as $$
begin
  -- ✅ Si el partido cambió a 'finalizado' y no ha sido resuelto
  if new.estado = 'finalizado' and not new.resultado_verificado then
    perform public.resolve_match_bets(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Crear trigger
drop trigger if exists trigger_auto_resolve_bets on public.matches;
create trigger trigger_auto_resolve_bets
  after update on public.matches
  for each row
  execute function public.auto_resolve_bets_on_match_end();

-- ============================================
-- PRIZE WINNERS
-- ============================================
create table if not exists public.prize_winners (
  id         uuid primary key default gen_random_uuid(),
  prize_id   uuid references public.prizes(id) on delete set null,
  user_id    uuid references public.users(id) on delete cascade,
  fase       text not null,
  posicion   integer,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.prize_winners enable row level security;

create policy "Anyone can read prize winners" on public.prize_winners
  for select using (true);

-- Escritura de ganadores SOLO vía assign_phase_prizes() (SECURITY DEFINER).

-- ============================================
-- FUNCIÓN: Ranking de una fase
-- ============================================
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

-- ============================================
-- FUNCIÓN: Asignar premios top 3 de una fase
-- ============================================
create or replace function public.assign_phase_prizes(p_fase text)
returns void as $$
declare
  v_ranking record;
  v_prize   record;
  v_pos     integer;
begin
  -- Borrar asignaciones previas para esta fase (re-asignable)
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

-- ============================================
-- VISTA: Ganadores con detalle de usuario y premio
-- ============================================
create or replace view public.prize_winners_detail as
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

-- ============================================
-- SECURITY: índice único + RPCs de registro/broadcast
-- ============================================

-- 1 apuesta por (usuario, partido)
-- Deduplicar antes (conserva la más antigua) por si hubiese datos previos
delete from public.bets
where id in (
  select id from (
    select id, row_number() over (partition by user_id, match_id order by created_at) as rn
    from public.bets
    where match_id is not null
  ) t
  where t.rn > 1
);
create unique index if not exists uniq_bet_user_match on public.bets(user_id, match_id);

-- Registro atómico: perfil + wallet + transacción inicial
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

-- Verificación de RIF en registro (sin exponer la tabla users)
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

-- Broadcast de notificación global (sólo admin)
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
