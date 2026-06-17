-- ============================================================
-- purge_seed_matches.sql
-- ONE-TIME cleanup: elimina partidos seed huérfanos (external_id IS NULL)
-- que el sync de API-Football nunca puede actualizar.
--
-- ANTES de ejecutar: verificar que el sync de API trae fixtures reales
-- y que no hay apuestas sobre estos partidos (ver diagnóstico abajo).
--
-- NO agregar a apply-migrations.mjs FILES — es limpieza one-shot.
-- ============================================================

-- ── Diagnóstico (comentar/descomentar según necesidad) ──
--
-- 1. Cuántos partidos hay (seed huérfanos vs. desde API):
-- select count(*) total,
--   count(*) filter (where external_id is null) seed_huerfanos,
--   count(*) filter (where external_id is not null) desde_api,
--   count(*) filter (where estado='finalizado') finalizados
-- from public.matches;
--
-- 2. Apuestas sobre partidos huérfanos (SI HAY, ejecutar el bloque de abajo):
-- select count(*) apuestas_en_huerfanos,
--   sum(monto) total_puntos
-- from public.bets b
-- join public.matches m on m.id = b.match_id
-- where m.external_id is null and b.estado = 'pendiente';

-- ── Reembolsar apuestas pendientes sobre partidos huérfanos ──
-- Los partidos seed huérfanos nunca finalizan (sync no los puede tocar).
-- Todas sus apuestas están en 'pendiente'. Reembolsamos antes de borrar.
do $$
declare
  v_bet record;
  v_wallet_id uuid;
  v_balance numeric;
begin
  for v_bet in
    select b.id, b.user_id, b.monto, m.id as match_id
    from public.bets b
    join public.matches m on m.id = b.match_id
    where m.external_id is null
      and b.estado = 'pendiente'
  loop
    -- Obtener wallet
    select id, balance into v_wallet_id, v_balance
    from public.wallets
    where user_id = v_bet.user_id
    for update;

    if v_wallet_id is not null then
      -- Reembolsar puntos
      update public.wallets
      set balance = balance + v_bet.monto,
          updated_at = now()
      where id = v_wallet_id;

      -- Registrar transacción
      insert into public.wallet_transactions
        (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
      values (
        v_wallet_id, v_bet.user_id, 'reembolso', v_bet.monto,
        v_balance + v_bet.monto,
        'Reembolso por anulación - partido sin datos oficiales',
        v_bet.id::text
      );

      -- Marcar apuesta como reembolsada
      update public.bets
      set estado = 'reembolsada', updated_at = now()
      where id = v_bet.id;

      raise notice 'Bet % reembolsada (% pts) for user %',
        v_bet.id, v_bet.monto, v_bet.user_id;
    end if;
  end loop;
end;
$$;

-- ── Eliminar partidos huérfanos ──
-- Las apuestas ya fueron reembolsadas arriba. El cascade delete de bets
-- borrará cualquier apuesta residual (no debería haber pendientes).
delete from public.matches
where external_id is null;

raise notice 'Partidos seed huérfanos eliminados.';
