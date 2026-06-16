-- ============================================================
-- IronBet — Security Hardening Migration
-- Run this in Supabase SQL Editor (single execution)
--
-- Corrige los hallazgos de la auditoría Pre-Vuelo:
--  #1  Políticas RLS abiertas (for all using(true)) → escalada de privilegios
--  #2  Multiplicador controlado por el cliente
--  #3  Apuestas duplicadas (sin UNIQUE)
--  #5  Registro no atómico (usuario huérfano)
--  #7  resolve_match_by_external_id ejecutable por cualquiera
--  #8  Fuga de PII de la tabla users
-- ============================================================

-- ────────────────────────────────────────────────
-- 0. Helper: is_admin()  (SECURITY DEFINER evita recursión RLS)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true);
$$;

-- ────────────────────────────────────────────────
-- 1. Cerrar políticas abiertas "for all using(true)"  (#1)
--    service_role bypassea RLS y las RPC son SECURITY DEFINER,
--    así que los flujos legítimos siguen funcionando.
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role manages wallets"        ON public.wallets;
DROP POLICY IF EXISTS "Service role manages transactions"   ON public.wallet_transactions;
DROP POLICY IF EXISTS "Service role manages bets"           ON public.bets;
DROP POLICY IF EXISTS "Service role manages matches"        ON public.matches;
DROP POLICY IF EXISTS "Service role manages notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Service role manages prize winners"  ON public.prize_winners;

-- Impedir INSERT directo de apuestas desde el cliente:
-- TODA apuesta debe pasar por place_bet() (SECURITY DEFINER).
DROP POLICY IF EXISTS "Users can create bets" ON public.bets;

-- matches: escritura SOLO para administradores (sync desde el panel)
DROP POLICY IF EXISTS "Admins manage matches" ON public.matches;
CREATE POLICY "Admins manage matches" ON public.matches
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────
-- 2. users: cerrar lectura pública de PII (#8)
--    El ranking público se sirve por la vista leaderboard.
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read users for leaderboard" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users"         ON public.users;

DROP POLICY IF EXISTS "Admins read all users" ON public.users;
CREATE POLICY "Admins read all users" ON public.users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ────────────────────────────────────────────────
-- 3. Vista leaderboard (corre con privilegios del owner → sin PII de users)
-- ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  u.id, u.nombre, u.empresa,
  w.balance, w.total_earned, w.total_won, w.total_wagered,
  (SELECT count(*) FROM public.bets b WHERE b.user_id = u.id AND b.estado = 'ganada')::integer AS apuestas_ganadas,
  (SELECT count(*) FROM public.bets b WHERE b.user_id = u.id)::integer AS total_apuestas,
  rank() OVER (ORDER BY (w.balance + w.total_won) DESC)::integer AS posicion
FROM public.users u
JOIN public.wallets w ON w.user_id = u.id
WHERE u.is_admin IS NOT TRUE
ORDER BY (w.balance + w.total_won) DESC;

GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- ────────────────────────────────────────────────
-- 4. Multiplicador AUTORITATIVO (server-side)  (#2)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_bet_multiplier(p_fase text, p_tipo text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_fase
    WHEN 'grupo'         THEN CASE p_tipo WHEN 'ganador' THEN 1.8 WHEN 'diferencia_goles' THEN 3.0 WHEN 'resultado_exacto' THEN 5.0  ELSE 2.0 END
    WHEN 'octavos'       THEN CASE p_tipo WHEN 'ganador' THEN 2.0 WHEN 'diferencia_goles' THEN 3.5 WHEN 'resultado_exacto' THEN 6.0  ELSE 2.0 END
    WHEN 'cuartos'       THEN CASE p_tipo WHEN 'ganador' THEN 2.2 WHEN 'diferencia_goles' THEN 4.0 WHEN 'resultado_exacto' THEN 7.0  ELSE 2.0 END
    WHEN 'semifinal'     THEN CASE p_tipo WHEN 'ganador' THEN 2.5 WHEN 'diferencia_goles' THEN 4.5 WHEN 'resultado_exacto' THEN 8.0  ELSE 2.0 END
    WHEN 'tercer_puesto' THEN CASE p_tipo WHEN 'ganador' THEN 2.0 WHEN 'diferencia_goles' THEN 3.5 WHEN 'resultado_exacto' THEN 6.0  ELSE 2.0 END
    WHEN 'final'         THEN CASE p_tipo WHEN 'ganador' THEN 3.0 WHEN 'diferencia_goles' THEN 5.0 WHEN 'resultado_exacto' THEN 10.0 ELSE 2.0 END
    ELSE 2.0
  END;
$$;

-- ────────────────────────────────────────────────
-- 5. UNIQUE: 1 apuesta por (usuario, partido)  (#3)
-- ────────────────────────────────────────────────
-- 5a. Deduplicar apuestas previas: conserva la MÁS ANTIGUA por (user_id, match_id)
--     y elimina el resto. (NULL match_id no se toca: se considera distinto.)
DELETE FROM public.bets
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, match_id ORDER BY created_at) AS rn
    FROM public.bets
    WHERE match_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- 5b. Crear el índice único
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bet_user_match ON public.bets(user_id, match_id);

-- ────────────────────────────────────────────────
-- 6. place_bet: nueva firma SIN p_multiplicador (#2, #3)
--    + valida autorización, monto, tipo, rango y duplicado.
-- ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_bet(uuid,integer,text,jsonb,numeric,numeric,text,text,integer,text,text,text,text,text,text,text,timestamptz);

CREATE OR REPLACE FUNCTION public.place_bet(
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

  -- Multiplicador autoritativo (server-side)
  v_multiplicador := public.get_bet_multiplier(p_fase, p_tipo_apuesta);

  -- Upsert match desde datos de la API (idempotente)
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

  -- Wallet + saldo (lock)
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

  -- Partido abierto a apuestas
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

  update public.wallets
  set balance = balance - p_monto,
      total_wagered = total_wagered + p_monto,
      updated_at = now()
  where id = v_wallet_id;

  insert into public.bets (user_id, match_id, match_external_id, tipo_apuesta, prediccion, monto, multiplicador, ganancia_potencial)
  values (p_user_id, v_match_id, p_external_id, p_tipo_apuesta, p_prediccion, p_monto, v_multiplicador, v_ganancia_potencial)
  returning id into v_bet_id;

  insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
  values (v_wallet_id, p_user_id, 'apuesta', -p_monto, v_balance - p_monto, 'Apuesta en partido', v_bet_id::text);

  return v_bet_id;
end;
$$ language plpgsql security definer;

-- ────────────────────────────────────────────────
-- 7. register_profile: registro atómico perfil+wallet+tx  (#1, #5)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_profile(
  p_rif text,
  p_nombre text,
  p_telefono text,
  p_empresa text DEFAULT '',
  p_zona text DEFAULT '',
  p_vendedor text DEFAULT '',
  p_puntos numeric DEFAULT 0
) returns void as $$
declare
  v_uid uuid;
  v_wallet_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Sesión requerida para registrar el perfil';
  end if;

  insert into public.users (id, rif, nombre, telefono, telefono_verificado, empresa, zona, vendedor)
  values (v_uid, p_rif, p_nombre, p_telefono, true, coalesce(p_empresa,''), coalesce(p_zona,''), coalesce(p_vendedor,''));

  insert into public.wallets (user_id, balance, total_earned)
  values (v_uid, coalesce(p_puntos,0), coalesce(p_puntos,0))
  returning id into v_wallet_id;

  if coalesce(p_puntos,0) > 0 then
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_uid, 'compra', p_puntos, p_puntos, 'Puntos iniciales por compras anteriores', 'registro_inicial');
  end if;
end;
$$ language plpgsql security definer;

-- ────────────────────────────────────────────────
-- 8. rif_exists: verificación de RIF en registro (sin exponer users)  (#8)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rif_exists(p_rif text, p_codigo text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE rif = p_rif OR (p_codigo IS NOT NULL AND rif = p_codigo)
  );
$$;
GRANT EXECUTE ON FUNCTION public.rif_exists(text, text) TO anon, authenticated;

-- ────────────────────────────────────────────────
-- 9. admin_broadcast_notification: envío global (sólo admin)  (#1)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_titulo text,
  p_mensaje text,
  p_tipo text DEFAULT 'info'
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

-- ────────────────────────────────────────────────
-- 10. resolve / upsert match: sólo admin  (#7)
--     (evita inyección de marcadores falsos por clientes)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_match_by_external_id(
  p_external_id integer,
  p_goles_local integer,
  p_goles_visitante integer,
  p_estado text
) returns void as $$
declare
  v_match_id uuid;
begin
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
    perform public.resolve_match_bets(v_match_id);
  end if;
end;
$$ language plpgsql security definer;
