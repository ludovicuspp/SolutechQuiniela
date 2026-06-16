#!/usr/bin/env node

/**
 * Script para testear la resolución automática de apuestas
 * 
 * Uso:
 *   node scripts/test-bet-resolution.mjs
 * 
 * Requisitos:
 *   - .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// ⚠️ Tras el endurecimiento de RLS, los INSERT directos a bets/matches requieren
// service_role. Define SUPABASE_SERVICE_ROLE_KEY en .env para correr este script.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY no definida — los INSERT directos pueden fallar por RLS.')
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  supabaseKey
)

async function testBetResolution() {
  console.log('\n🎯 SCRIPT: Testear Resolución de Apuestas\n')

  try {
    // 1️⃣ Obtener un partido existente
    console.log('1️⃣ Buscando un partido para testear...')
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .limit(1)

    if (matchError || !matches?.length) {
      console.error('❌ No hay partidos en BD')
      return
    }

    const testMatch = matches[0]
    console.log(`   ✅ Encontrado: ${testMatch.equipo_local} vs ${testMatch.equipo_visitante}`)
    console.log(`   ID: ${testMatch.id}`)
    console.log(`   Estado actual: ${testMatch.estado}`)

    // 2️⃣ Crear datos de prueba (bets)
    console.log('\n2️⃣ Creando apuestas de prueba...')
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (userError || !userData?.length) {
      console.error('❌ No hay usuarios en BD')
      return
    }

    const testUserId = userData[0].id
    console.log(`   Usuario de prueba: ${testUserId}`)

    // Crear 3 apuestas: 1 ganadora, 1 perdedora, 1 distinto tipo
    const testBets = [
      {
        user_id: testUserId,
        match_id: testMatch.id,
        match_external_id: testMatch.external_id,
        tipo_apuesta: 'ganador',
        prediccion: { resultado: 'local' },  // Apuesta: gana local
        monto: 100,
        multiplicador: 1.8,
        ganancia_potencial: 180
      },
      {
        user_id: testUserId,
        match_id: testMatch.id,
        match_external_id: testMatch.external_id,
        tipo_apuesta: 'ganador',
        prediccion: { resultado: 'visitante' },  // Apuesta: gana visitante
        monto: 50,
        multiplicador: 2.1,
        ganancia_potencial: 105
      },
      {
        user_id: testUserId,
        match_id: testMatch.id,
        match_external_id: testMatch.external_id,
        tipo_apuesta: 'resultado_exacto',
        prediccion: { goles_local: 2, goles_visitante: 1 },
        monto: 75,
        multiplicador: 5.0,
        ganancia_potencial: 375
      }
    ]

    const { data: createdBets, error: betError } = await supabase
      .from('bets')
      .insert(testBets)
      .select()

    if (betError) {
      console.error('❌ Error creando apuestas:', betError)
      return
    }

    console.log(`   ✅ Creadas ${createdBets.length} apuestas de prueba`)
    console.log(`   Estados iniciales: todos en 'pendiente'`)

    // 3️⃣ Actualizar partido a "finalizado" con resultado
    console.log('\n3️⃣ Actualizando partido a "finalizado"...')
    console.log(`   Resultado simulado: ${testMatch.equipo_local} 2 - 1 ${testMatch.equipo_visitante}`)

    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({
        estado: 'finalizado',
        goles_local: 2,
        goles_visitante: 1,
        resultado_verificado: false  // Importante: no verificado aún
      })
      .eq('id', testMatch.id)
      .select()

    if (updateError) {
      console.error('❌ Error actualizando partido:', updateError)
      return
    }

    console.log(`   ✅ Partido actualizado`)
    console.log(`   El TRIGGER debería ejecutarse automáticamente...`)

    // 4️⃣ Esperar un poquito y verificar resultados
    console.log('\n4️⃣ Esperando ejecución del trigger (2 segundos)...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('\n5️⃣ Verificando resultados...')

    // Obtener apuestas actualizadas
    const { data: resolvedBets, error: checkError } = await supabase
      .from('bets')
      .select('*')
      .in('id', createdBets.map(b => b.id))

    if (checkError) {
      console.error('❌ Error verificando apuestas:', checkError)
      return
    }

    console.log(`\n   📊 Resultados de las apuestas:`)
    resolvedBets.forEach((bet, idx) => {
      const status = bet.estado === 'ganada' ? '✅ GANADA' : bet.estado === 'perdida' ? '❌ PERDIDA' : '⏳ PENDIENTE'
      console.log(`\n   Apuesta ${idx + 1}:`)
      console.log(`   Tipo: ${bet.tipo_apuesta}`)
      console.log(`   Predicción: ${JSON.stringify(bet.prediccion)}`)
      console.log(`   Estado: ${status}`)
      console.log(`   Ganancia: ${bet.ganancia_real || 0} pts`)
    })

    // Verificar wallet actualizada
    console.log(`\n   💰 Wallet del usuario:`)
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, total_won')
      .eq('user_id', testUserId)
      .single()

    if (!walletError && wallet) {
      console.log(`   Balance: ${wallet.balance}`)
      console.log(`   Total ganado: ${wallet.total_won}`)
    }

    // Verificar notificaciones
    console.log(`\n   🔔 Notificaciones enviadas:`)
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('titulo, mensaje, tipo')
      .eq('user_id', testUserId)
      .eq('tipo', 'bet_result')
      .order('created_at', { ascending: false })
      .limit(3)

    if (!notifError && notifications?.length) {
      notifications.forEach(notif => {
        console.log(`   - ${notif.titulo}: ${notif.mensaje}`)
      })
    }

    console.log('\n✅ TEST COMPLETADO!\n')

    // Limpiar datos de prueba (opcional)
    console.log('🧹 Limpiando datos de prueba...')
    await supabase.from('bets').delete().in('id', createdBets.map(b => b.id))
    await supabase
      .from('matches')
      .update({
        estado: 'programado',
        goles_local: null,
        goles_visitante: null,
        resultado_verificado: false
      })
      .eq('id', testMatch.id)

    console.log('   ✅ Datos limpios\n')

  } catch (err) {
    console.error('\n❌ ERROR FATAL:', err.message)
    process.exit(1)
  }
}

testBetResolution()
