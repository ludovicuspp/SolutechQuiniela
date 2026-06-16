-- ============================================
-- IronMundial 2026 - Prize Winners Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Agregar columna posicion a prize_winners
ALTER TABLE public.prize_winners
  ADD COLUMN IF NOT EXISTS posicion integer;

-- 2. RLS policies para prize_winners (si no existen)
ALTER TABLE public.prize_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read prize winners" ON public.prize_winners;
CREATE POLICY "Anyone can read prize winners" ON public.prize_winners
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages prize winners" ON public.prize_winners;
CREATE POLICY "Service role manages prize winners" ON public.prize_winners
  FOR ALL USING (true);

-- 3. Función: calcular ranking de una fase
--    Suma ganancia_real de bets cuyo match pertenece a esa fase
CREATE OR REPLACE FUNCTION public.get_phase_ranking(p_fase text)
RETURNS TABLE (
  user_id   uuid,
  nombre    text,
  empresa   text,
  puntos    numeric,
  posicion  integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sub.uid,
    sub.u_nombre,
    sub.u_empresa,
    sub.total_puntos,
    ROW_NUMBER() OVER (ORDER BY sub.total_puntos DESC)::integer
  FROM (
    SELECT
      u.id                                  AS uid,
      u.nombre                              AS u_nombre,
      u.empresa                             AS u_empresa,
      COALESCE(SUM(b.ganancia_real), 0)     AS total_puntos
    FROM public.users u
    LEFT JOIN public.bets b
      ON b.user_id = u.id
      AND b.estado = 'ganada'
      AND EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = b.match_id
          AND m.fase = p_fase
      )
    WHERE u.is_admin = false
    GROUP BY u.id, u.nombre, u.empresa
  ) sub
  ORDER BY sub.total_puntos DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función principal: asignar premios a top 3 de una fase
--    - Busca los 3 prizes de esa fase (posicion 1,2,3)
--    - Asigna el user con más puntos en esa fase a cada prize
--    - Inserta en prize_winners (idempotente: si ya existe no duplica)
--    - Envía notificación al ganador
CREATE OR REPLACE FUNCTION public.assign_phase_prizes(p_fase text)
RETURNS void AS $$
DECLARE
  v_ranking   RECORD;
  v_prize     RECORD;
  v_pos       integer;
BEGIN
  -- Borrar asignaciones previas para esta fase (re-asignable)
  DELETE FROM public.prize_winners WHERE fase = p_fase;

  -- Iterar top 3 del ranking
  FOR v_ranking IN
    SELECT * FROM public.get_phase_ranking(p_fase) LIMIT 3
  LOOP
    v_pos := v_ranking.posicion;

    -- Buscar el prize correspondiente a esta fase y posición
    SELECT * INTO v_prize
    FROM public.prizes
    WHERE fase = p_fase AND posicion = v_pos
    LIMIT 1;

    -- Insertar ganador (con o sin prize_id si no hay prize configurado)
    INSERT INTO public.prize_winners (id, prize_id, user_id, fase, posicion, created_at)
    VALUES (
      gen_random_uuid(),
      v_prize.id,   -- puede ser NULL si no hay prize configurado para esa posición
      v_ranking.user_id,
      p_fase,
      v_pos,
      now()
    );

    -- Notificar al usuario
    INSERT INTO public.notifications (user_id, titulo, mensaje, tipo, data)
    VALUES (
      v_ranking.user_id,
      CASE v_pos
        WHEN 1 THEN '🥇 ¡Ganaste el 1er Premio!'
        WHEN 2 THEN '🥈 ¡Ganaste el 2do Premio!'
        WHEN 3 THEN '🥉 ¡Ganaste el 3er Premio!'
      END,
      CASE
        WHEN v_prize.id IS NOT NULL THEN
          'Felicitaciones! Ganaste el premio "' || v_prize.titulo || '" en la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
        ELSE
          'Felicitaciones! Quedaste en la posicion ' || v_pos || ' de la fase ' || p_fase || ' con ' || v_ranking.puntos || ' puntos.'
      END,
      'success',
      jsonb_build_object(
        'fase', p_fase,
        'posicion', v_pos,
        'puntos', v_ranking.puntos,
        'prize_id', v_prize.id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Vista: ganadores con datos de usuario y premio
CREATE OR REPLACE VIEW public.prize_winners_detail AS
SELECT
  pw.id,
  pw.fase,
  pw.posicion,
  pw.claimed_at,
  pw.created_at,
  u.nombre       AS usuario_nombre,
  u.empresa      AS usuario_empresa,
  pw.user_id,
  p.titulo       AS premio_titulo,
  p.descripcion  AS premio_descripcion,
  pw.prize_id
FROM public.prize_winners pw
LEFT JOIN public.users   u ON u.id = pw.user_id
LEFT JOIN public.prizes  p ON p.id = pw.prize_id
ORDER BY pw.fase, pw.posicion;
