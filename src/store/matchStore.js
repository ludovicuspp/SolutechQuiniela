import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { canBetOnMatch } from '../utils/formatters'

const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ])
}

export const useMatchStore = create((set, get) => ({
  allMatches: [],
  loading: false,
  selectedFase: 'todos',
  error: null,
  livePollingInterval: null,

  fetchMatches: async () => {
    console.log('[matchStore] fetchMatches start, hasData:', get().allMatches.length > 0, 'loading:', get().loading)
    if (get().allMatches.length > 0 || get().loading) return
    set({ loading: true, error: null })
    try {
      const { data, error: sbError } = await supabase
        .from('matches')
        .select('*')
        .order('fecha_partido', { ascending: true })
      if (sbError) throw sbError
      console.log('[matchStore] fetchMatches done, rows:', data?.length)
      set({ allMatches: data || [], loading: false })
      get().checkLiveMatches()
    } catch (err) {
      console.error('[matchStore] fetchMatches error:', err.message)
      set({ error: err.message, loading: false })
    }
  },

  refetchMatches: async () => {
    set({ loading: true, error: null })
    try {
      const { data, error: sbError } = await supabase
        .from('matches')
        .select('*')
        .order('fecha_partido', { ascending: true })
      if (sbError) throw sbError
      set({ allMatches: data || [] })
      get().checkLiveMatches()
    } catch (err) {
      set({ error: err.message })
    } finally {
      set({ loading: false })
    }
  },

  setFase: (fase) => {
    set({ selectedFase: fase })
  },

  getFilteredMatches: () => {
    const { allMatches, selectedFase } = get()
    if (selectedFase === 'todos') return allMatches
    return allMatches.filter(m => m.fase === selectedFase)
  },

  getUpcomingMatches: () => {
    return get().allMatches.filter(m => canBetOnMatch(m))
  },

  getRecentResults: () => {
    return get().allMatches.filter(m => m.estado === 'finalizado')
      .sort((a, b) => new Date(b.fecha_partido) - new Date(a.fecha_partido))
      .slice(0, 6)
  },

  getMatchById: (id) => {
    return get().allMatches.find(m => m.id === id || m.external_id === id)
  },

  getLiveMatches: () => {
    return get().allMatches.filter(m => m.estado === 'en_juego')
  },

  checkLiveMatches: () => {
    const liveMatches = get().getLiveMatches()
    if (liveMatches.length > 0 && !get().livePollingInterval) {
      get().startLivePolling()
    } else if (liveMatches.length === 0 && get().livePollingInterval) {
      get().stopLivePolling()
    }
  },

  updateLiveScores: async () => {
    const liveMatches = get().getLiveMatches()
    if (liveMatches.length === 0) return

    let data
    try {
      ;({ data } = await withTimeout(
        supabase
          .from('matches')
          .select('*')
          .in('id', liveMatches.map(m => m.id)),
        8000
      ))
    } catch (err) {
      console.error('[updateLiveScores] timeout or error:', err.message)
      return
    }
    if (!data) return

    const newMatches = [...get().allMatches]
    let changed = false

    for (const updated of data) {
      const idx = newMatches.findIndex(m => m.id === updated.id)
      if (idx === -1) continue
      const current = newMatches[idx]
      if (
        current.goles_local !== updated.goles_local ||
        current.goles_visitante !== updated.goles_visitante ||
        current.estado !== updated.estado ||
        current.penales_local !== updated.penales_local ||
        current.penales_visitante !== updated.penales_visitante
      ) {
        newMatches[idx] = updated
        changed = true
      }
    }

    if (changed) {
      set({ allMatches: newMatches })
      get().checkLiveMatches()
    }
  },

  startLivePolling: () => {
    if (get().livePollingInterval) return
    const interval = setInterval(() => {
      get().updateLiveScores()
    }, 30000)
    set({ livePollingInterval: interval })
  },

  stopLivePolling: () => {
    if (get().livePollingInterval) {
      clearInterval(get().livePollingInterval)
      set({ livePollingInterval: null })
    }
  },
}))
