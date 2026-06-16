import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAdminStore = create((set, get) => ({
  isLoading: false,
  isSendingNotification: false,
  error: null,
  lastSync: null,

  prizes: [],
  isLoadingPrizes: false,
  isSubmittingPrize: false,

  prizeWinners: [],
  isLoadingWinners: false,
  isAssigningPrizes: false,

  syncMatchesWithAPI: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.functions.invoke('sync-matches', {
        method: 'POST',
        body: {},
      })
      if (error) throw error
      set({ lastSync: new Date().toISOString(), isLoading: false })
      return { success: true, count: data?.count ?? 0 }
    } catch (err) {
      const errorMessage = err.message || 'Error sincronizando partidos'
      console.error('[syncMatchesWithAPI] error:', errorMessage)
      set({ error: errorMessage, isLoading: false })
      return { success: false, error: errorMessage }
    }
  },

  clearError: () => set({ error: null }),

  fetchUsersWithWallets: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.rpc('public_admin_get_users')
      if (error) throw error
      const users = (data || []).map(u => ({
        id: u.id,
        rif: u.rif,
        nombre: u.nombre,
        telefono: u.telefono,
        zona: u.zona,
        wallets: {
          balance: u.wallet_balance,
          total_earned: u.wallet_earned,
          total_wagered: u.wallet_wagered,
          total_won: u.wallet_won,
        }
      }))
      set({ isLoading: false })
      return { success: true, users }
    } catch (err) {
      const errorMessage = err.message || 'Error cargando usuarios'
      set({ error: errorMessage, isLoading: false })
      return { success: false, error: errorMessage }
    }
  },

  sendGlobalNotification: async (titulo, mensaje, tipo = 'info') => {
    set({ isSendingNotification: true, error: null })
    try {
      const { data, error } = await supabase.rpc('public_admin_broadcast_notification', {
        p_titulo: titulo,
        p_mensaje: mensaje,
        p_tipo: tipo,
      })
      if (error) throw error
      set({ isSendingNotification: false })
      return { success: true, count: data }
    } catch (err) {
      console.error('Error sending global notification:', err)
      const errorMessage = err.message || 'Error enviando notificacion'
      set({ error: errorMessage, isSendingNotification: false })
      return { success: false, error: errorMessage }
    }
  },

  loadUsers: async () => {
    try {
      const { data, error } = await supabase.rpc('public_admin_get_users')
      if (error) throw error
      const users = (data || []).map(u => ({
        id: u.id,
        rif: u.rif,
        nombre: u.nombre,
        telefono: u.telefono,
        zona: u.zona,
        vendedor: u.vendedor,
        empresa: u.empresa,
        is_admin: u.is_admin,
        created_at: u.created_at,
        wallets: {
          balance: u.wallet_balance,
          total_earned: u.wallet_earned,
          total_wagered: u.wallet_wagered,
          total_won: u.wallet_won,
        }
      }))
      return { success: true, users }
    } catch (err) {
      console.error('[loadUsers] error:', err)
      return { success: false, error: err.message }
    }
  },

  createUser: async (userData) => {
    try {
      const { nombre, rif, telefono, zona, vendedor, empresa, puntosIniciales, is_admin } = userData
      const { data, error } = await supabase.rpc('public_admin_create_user', {
        p_email:    userData.email,
        p_password: userData.password,
        p_rif:      rif,
        p_nombre:   nombre,
        p_telefono: telefono  || '',
        p_zona:     zona      || '',
        p_vendedor: vendedor  || '',
        p_empresa:  empresa   || '',
        p_puntos:   puntosIniciales || 0,
        p_is_admin: is_admin  || false,
      })
      if (error) throw error
      return { success: true, userId: data }
    } catch (err) {
      console.error('[createUser] error:', err)
      return { success: false, error: err.message }
    }
  },

  updateUser: async (userId, updateData) => {
    try {
      const { error } = await supabase.rpc('public_admin_update_user', {
        p_user_id: userId,
        p_nombre: updateData.nombre,
        p_rif: updateData.rif,
        p_telefono: updateData.telefono,
        p_zona: updateData.zona,
        p_vendedor: updateData.vendedor,
        p_empresa: updateData.empresa,
        p_is_admin: updateData.is_admin,
      })
      if (error) throw error
      return { success: true }
    } catch (err) {
      console.error('[updateUser] CATCH error:', err)
      return { success: false, error: err.message }
    }
  },

  deleteUser: async (userId) => {
    try {
      const { error } = await supabase.rpc('public_admin_delete_user', { p_user_id: userId })
      if (error) throw error
      return { success: true }
    } catch (err) {
      console.error('[deleteUser] error:', err)
      return { success: false, error: err.message }
    }
  },

  fetchPrizes: async () => {
    set({ isLoadingPrizes: true, error: null })
    try {
      const { data, error } = await supabase
        .from('prizes')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      set({ prizes: data || [], isLoadingPrizes: false })
      return { success: true, data }
    } catch (err) {
      console.error('[fetchPrizes] error:', err)
      set({ error: err.message, isLoadingPrizes: false })
      return { success: false, error: err.message }
    }
  },

  createPrize: async (prizeData) => {
    set({ isSubmittingPrize: true, error: null })
    try {
      const { data, error } = await supabase
        .from('prizes')
        .insert([prizeData])
        .select()
      if (error) throw error
      set(state => ({
        prizes: [...state.prizes, data[0]],
        isSubmittingPrize: false
      }))
      return { success: true, data: data[0] }
    } catch (err) {
      console.error('[createPrize] error:', err)
      set({ error: err.message, isSubmittingPrize: false })
      return { success: false, error: err.message }
    }
  },

  updatePrize: async (id, updatedData) => {
    set({ isSubmittingPrize: true, error: null })
    try {
      const { data, error } = await supabase
        .from('prizes')
        .update(updatedData)
        .eq('id', id)
        .select()
      if (error) throw error
      set(state => ({
        prizes: state.prizes.map(p => p.id === id ? data[0] : p),
        isSubmittingPrize: false
      }))
      return { success: true, data: data[0] }
    } catch (err) {
      console.error('[updatePrize] error:', err)
      set({ error: err.message, isSubmittingPrize: false })
      return { success: false, error: err.message }
    }
  },

  deletePrize: async (id) => {
    set({ isSubmittingPrize: true, error: null })
    try {
      const { error } = await supabase
        .from('prizes')
        .delete()
        .eq('id', id)
      if (error) throw error
      set(state => ({
        prizes: state.prizes.filter(p => p.id !== id),
        isSubmittingPrize: false
      }))
      return { success: true }
    } catch (err) {
      console.error('[deletePrize] error:', err)
      set({ error: err.message, isSubmittingPrize: false })
      return { success: false, error: err.message }
    }
  },

  fetchPrizeWinners: async () => {
    set({ isLoadingWinners: true })
    try {
      const { data, error } = await supabase
        .from('prize_winners_detail')
        .select('*')
        .order('fase')
        .order('posicion')
      if (error) throw error
      set({ prizeWinners: data || [], isLoadingWinners: false })
      return { success: true, data: data || [] }
    } catch (err) {
      console.error('[fetchPrizeWinners] error:', err)
      set({ isLoadingWinners: false })
      return { success: false, error: err.message }
    }
  },

  assignPhasePrizes: async (fase) => {
    set({ isAssigningPrizes: true })
    try {
      const { error } = await supabase.rpc('assign_phase_prizes', { p_fase: fase })
      if (error) throw error
      await get().fetchPrizeWinners()
      set({ isAssigningPrizes: false })
      return { success: true }
    } catch (err) {
      console.error('[assignPhasePrizes] error:', err)
      set({ isAssigningPrizes: false })
      return { success: false, error: err.message }
    }
  },
}))

export const useResolveBets = create((set, get) => ({
  finishedMatches: [],
  isLoadingFinished: false,
  isResolvingBets: false,

  fetchFinishedMatches: async () => {
    set({ isLoadingFinished: true })
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, external_id, fase, equipo_local, equipo_visitante, goles_local, goles_visitante, estado, resultado_verificado, penales_local, penales_visitante')
        .eq('estado', 'finalizado')
        .eq('resultado_verificado', false)
        .order('fecha_partido', { ascending: false })
      if (error) throw error
      set({ finishedMatches: data || [] })
      return data
    } catch (err) {
      console.error('[fetchFinishedMatches] Error:', err.message)
      return []
    } finally {
      set({ isLoadingFinished: false })
    }
  },

  resolveMatchBets: async (matchId) => {
    set({ isResolvingBets: true })
    try {
      const { error } = await supabase.rpc('resolve_match_bets', { p_match_id: matchId })
      if (error) throw error
      console.log('[resolveMatchBets] Apuestas resueltas para match:', matchId)
      await get().fetchFinishedMatches()
      return { success: true }
    } catch (err) {
      console.error('[resolveMatchBets] Error:', err.message)
      return { success: false, error: err.message }
    } finally {
      set({ isResolvingBets: false })
    }
  },

  setMatchPenalties: async (matchId, penLocal, penVisitante) => {
    try {
      const { error } = await supabase.rpc('admin_set_penalties', {
        p_match_id: matchId,
        p_pen_local: penLocal,
        p_pen_visitante: penVisitante,
      })
      if (error) throw error
      set(state => ({
        finishedMatches: state.finishedMatches.map(m =>
          m.id === matchId
            ? { ...m, penales_local: penLocal, penales_visitante: penVisitante }
            : m
        ),
      }))
      return { success: true }
    } catch (err) {
      console.error('[setMatchPenalties] Error:', err.message)
      return { success: false, error: err.message }
    }
  },
}))
