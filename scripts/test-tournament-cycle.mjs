#!/usr/bin/env node
/**
 * Test: Ciclo completo de torneo
 *
 * Simula:
 *   1. Crear 3 partidos de fase 'grupo'
 *   2. Crear apuestas para 3 usuarios distintos
 *   3. Finalizar los partidos (trigger resuelve apuestas)
 *   4. Llamar assign_phase_prizes('grupo')
 *   5. Verificar prize_winners y notificaciones
 *   6. Limpiar datos de prueba
 *
 * Uso: node scripts/test-tournament-cycle.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// ⚠️ Tras el endurecimiento de RLS, los INSERT directos a bets/matches y la asignación
// de premios requieren service_role. Define SUPABASE_SERVICE_ROLE_KEY en .env.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY no definida — los INSERT directos pueden fallar por RLS.')
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  supabaseKey
)

// IDs creados durante el test (para limpiar al final)
const cleanup = { matchIds: [], betIds: [], notifIds: [] }

async function run() {
  console.log('\n🏆 TEST: Ciclo Completo de Torneo\n')

  // ─── 1. Obtener usuarios via leaderboard view ──────────────────────────
  console.log('1️⃣  Obteniendo usuarios...')
  const { data: leaderRows, error: usersErr } = await supabase
    .from('leaderboard')
    .select('id, nombre, empresa')
    .limit(3)

  if (usersErr) {
    console.error('❌ Error leyendo leaderboard:', usersErr.message)
    process.exit(1)
  }

  const users = (leaderRows || []).map(r => ({ id: r.id, nombre: r.nombre }))

  if (users.length < 1) {
    console.error('❌ Necesitas al menos 1 usuario con wallet en la BD')
    process.exit(1)
  }
  console.log(`   ✅ Usuarios: ${users.map(u => u.nombre).join(', ')}`)
  // Rellenar hasta 3 usuarios repitiendo si hay menos
  while (users.length < 3) users.push(users[users.length - 1])

  // ─── 2. Crear 3 partidos de prueba en fase 'grupo' ──────────────────────
  console.log('\n2️⃣  Creando partidos de prueba (fase: grupo)...')
  const matchRows = [
    { equipo_local: 'Test A', equipo_visitante: 'Test B', fase: 'grupo', fecha_partido: new Date().toISOString(), estado: 'programado', apuestas_abiertas: false },
    { equipo_local: 'Test C', equipo_visitante: 'Test D', fase: 'grupo', fecha_partido: new Date().toISOString(), estado: 'programado', apuestas_abiertas: false },
    { equipo_local: 'Test E', equipo_visitante: 'Test F', fase: 'grupo', fecha_partido: new Date().toISOString(), estado: 'programado', apuestas_abiertas: false },
  ]

  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .insert(matchRows)
    .select()

  if (matchErr) { console.error('❌ Error creando partidos:', matchErr); process.exit(1) }
  cleanup.matchIds = matches.map(m => m.id)
  console.log(`   ✅ Creados ${matches.length} partidos`)

  // ─── 3. Crear apuestas (cada usuario apuesta en cada partido) ───────────
  console.log('\n3️⃣  Creando apuestas de prueba...')
  // Multiplicadores distintos → ganancias distintas → ranking diferenciado
  const betRows = []
  matches.forEach((match, mi) => {
    users.forEach((user, ui) => {
      // Usuario 0 apuesta más → debería ganar más puntos → 1er lugar
      const monto = [200, 100, 50][ui]
      betRows.push({
        user_id: match.id ? user.id : user.id,
        match_id: match.id,
        match_external_id: null,
        tipo_apuesta: 'ganador',
        prediccion: { resultado: 'local' },  // todos apuestan local → todos ganan
        monto,
        multiplicador: 1.8,
        ganancia_potencial: monto * 1.8,
        estado: 'pendiente',
      })
    })
  })

  const { data: bets, error: betErr } = await supabase
    .from('bets')
    .insert(betRows)
    .select()

  if (betErr) { console.error('❌ Error creando apuestas:', betErr); process.exit(1) }
  cleanup.betIds = bets.map(b => b.id)
  console.log(`   ✅ Creadas ${bets.length} apuestas`)

  // ─── 4. Finalizar partidos (local gana 2-0 → trigger resuelve apuestas) ─
  console.log('\n4️⃣  Finalizando partidos (trigger auto-resolución)...')
  for (const match of matches) {
    const { error } = await supabase
      .from('matches')
      .update({ estado: 'finalizado', goles_local: 2, goles_visitante: 0, resultado_verificado: false })
      .eq('id', match.id)

    if (error) { console.error('❌ Error finalizando partido:', error); process.exit(1) }
  }
  console.log('   ✅ Partidos finalizados — esperando trigger (2s)...')
  await new Promise(r => setTimeout(r, 2000))

  // ─── 5. Verificar que las apuestas se resolvieron ───────────────────────
  console.log('\n5️⃣  Verificando resolución de apuestas...')
  const { data: resolvedBets } = await supabase
    .from('bets')
    .select('estado, ganancia_real, user_id')
    .in('id', cleanup.betIds)

  const ganadas  = resolvedBets.filter(b => b.estado === 'ganada').length
  const perdidas = resolvedBets.filter(b => b.estado === 'perdida').length
  const pending  = resolvedBets.filter(b => b.estado === 'pendiente').length
  console.log(`   Ganadas: ${ganadas} | Perdidas: ${perdidas} | Pendientes: ${pending}`)
  if (pending > 0) console.warn('   ⚠️  Hay apuestas sin resolver — revisa el trigger')

  // ─── 6. Asignar premios de la fase 'grupo' ──────────────────────────────
  console.log('\n6️⃣  Asignando premios de fase "grupo"...')
  const { error: assignErr } = await supabase.rpc('assign_phase_prizes', { p_fase: 'grupo' })
  if (assignErr) {
    console.error('❌ Error asignando premios:', assignErr)
    process.exit(1)
  }
  console.log('   ✅ assign_phase_prizes ejecutado')

  // ─── 7. Verificar prize_winners ─────────────────────────────────────────
  console.log('\n7️⃣  Verificando ganadores asignados...')
  const { data: winners, error: winnersErr } = await supabase
    .from('prize_winners_detail')
    .select('*')
    .eq('fase', 'grupo')
    .order('posicion')

  if (winnersErr) { console.error('❌ Error leyendo prize_winners_detail:', winnersErr); }
  else if (winners.length === 0) {
    console.warn('   ⚠️  No se encontraron ganadores — revisa la función assign_phase_prizes')
  } else {
    console.log(`   📊 Top ${winners.length} ganadores en fase "grupo":`)
    winners.forEach(w => {
      console.log(`   ${w.posicion === 1 ? '🥇' : w.posicion === 2 ? '🥈' : '🥉'} ${w.usuario_nombre} — Premio: ${w.premio_titulo || '(sin premio configurado)'}`)
    })
  }

  // ─── 8. Verificar notificaciones enviadas ───────────────────────────────
  console.log('\n8️⃣  Verificando notificaciones de premio...')
  const winnerUserIds = (winners || []).map(w => w.user_id)
  if (winnerUserIds.length > 0) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('user_id, titulo, mensaje')
      .in('user_id', winnerUserIds)
      .eq('tipo', 'success')
      .order('created_at', { ascending: false })
      .limit(9)

    cleanup.notifIds = (notifs || []).map(n => n.id)
    console.log(`   🔔 ${notifs?.length || 0} notificaciones de premio enviadas`)
    notifs?.forEach(n => console.log(`   - ${n.titulo}`))
  }

  console.log('\n✅ TEST COMPLETADO!\n')

  // ─── Limpieza ────────────────────────────────────────────────────────────
  console.log('🧹 Limpiando datos de prueba...')

  // Borrar prize_winners de la fase de prueba para los usuarios de prueba
  if (winnerUserIds.length > 0) {
    await supabase.from('prize_winners').delete().eq('fase', 'grupo').in('user_id', winnerUserIds)
  }
  if (cleanup.betIds.length > 0) {
    await supabase.from('bets').delete().in('id', cleanup.betIds)
  }
  if (cleanup.matchIds.length > 0) {
    await supabase.from('matches').delete().in('id', cleanup.matchIds)
  }

  console.log('   ✅ Limpiezai completa\n')
}

run().catch(err => {
  console.error('\n❌ ERROR FATAL:', err.message)
  process.exit(1)
})
