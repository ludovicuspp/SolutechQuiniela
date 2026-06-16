import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const MULTIPLIERS = {
  ganador: 2.0,
  empate: 3.0,
  resultado_exacto: 5.0,
}

export const getMultiplier = (_fase, tipoBet) => {
  return MULTIPLIERS[tipoBet] || 2.0
}

export const useBetStore = create((set, get) => ({
  myBets: [],
  loading: false,

  fetchMyBets: async (userId) => {
    if (!userId) return
    if (get().loading) return
    console.log('[betStore] fetchMyBets start, userId:', userId)
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('bets')
        .select('*, matches(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      console.log('[betStore] fetchMyBets done, bets:', data?.length)
      if (!error && data) set({ myBets: data })
    } catch (err) {
      console.error('[betStore] fetchMyBets error:', err)
    } finally {
      set({ loading: false })
    }
  },

  placeBet: async (userId, match, tipoApuesta, prediccion, monto) => {
    const multiplicador = getMultiplier(match.fase, tipoApuesta)

    const { data, error } = await supabase.rpc('place_bet', {
      p_user_id: userId,
      p_external_id: match.external_id,
      p_tipo_apuesta: tipoApuesta,
      p_prediccion: prediccion,
      p_monto: monto,
      p_fase: match.fase,
      p_grupo: match.grupo || null,
      p_jornada: match.jornada || null,
      p_equipo_local: match.equipo_local,
      p_equipo_visitante: match.equipo_visitante,
      p_codigo_local: match.codigo_local || null,
      p_codigo_visitante: match.codigo_visitante || null,
      p_bandera_local: match.bandera_local || null,
      p_bandera_visitante: match.bandera_visitante || null,
      p_sede: match.sede || null,
      p_fecha_partido: match.fecha_partido,
    })

    if (error) throw error

    const newBet = {
      id: data?.bet_id || `temp-${Date.now()}`,
      user_id: userId,
      match_id: match.id,
      match_external_id: match.external_id,
      tipo_apuesta: tipoApuesta,
      prediccion: prediccion,
      monto: monto,
      multiplicador: multiplicador,
      ganancia_potencial: monto * multiplicador,
      estado: 'pendiente',
      ganancia_real: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      matches: match,
    }

    set({ myBets: [newBet, ...get().myBets] })

    get().fetchMyBets(userId).catch(() => {})

    return data
  },

  getBetsByMatch: (matchId) => {
    return get().myBets.filter(b => b.match_id === matchId)
  },

  hasBetOnMatch: (externalId) => {
    const bets = get().myBets
    if (!bets || bets.length === 0) return false
    return bets.some(b =>
      b.match_external_id === externalId ||
      b.matches?.external_id === externalId
    )
  },

  getStats: () => {
    const bets = get().myBets
    return {
      total: bets.length,
      pendientes: bets.filter(b => b.estado === 'pendiente').length,
      ganadas: bets.filter(b => b.estado === 'ganada').length,
      perdidas: bets.filter(b => b.estado === 'perdida').length,
      totalApostado: bets.reduce((sum, b) => sum + Number(b.monto), 0),
      totalGanado: bets.reduce((sum, b) => sum + Number(b.ganancia_real || 0), 0),
    }
  },

  resolveMatchBets: async (externalId) => {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('external_id', externalId)
      .single()

    if (matchError || !match) {
      console.error('[resolveMatchBets] Match not found in DB:', externalId)
      return { success: false, error: 'Partido no encontrado en la BD' }
    }

    if (match.estado === 'finalizado') {
      const { error } = await supabase.rpc('resolve_match_by_external_id', {
        p_external_id: match.external_id,
        p_goles_local: match.goles_local,
        p_goles_visitante: match.goles_visitante,
        p_estado: match.estado,
      })

      if (error) {
        console.error('[resolveMatchBets] RPC error:', error.message)
        return { success: false, error: error.message }
      }

      return { success: true }
    }

    return { success: false, error: 'El partido aún no ha finalizado' }
  },
}))
