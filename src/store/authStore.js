import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useMatchStore } from './matchStore'

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ])

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  wallet: null,
  loading: true,
  initialized: false,
  authUnsubscribe: null,
  isLoadingProfile: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await get().loadProfile(session.user.id)
        set({ user: session.user })
      }
    } catch (err) {
      console.error('Auth init error:', err)
    } finally {
      set({ loading: false, initialized: true })
    }

    get().authUnsubscribe?.()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ user: session.user })
        if (!get().profile) {
          await get().loadProfile(session.user.id)
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        set({ user: session.user })
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, wallet: null })
      }
    })

    set({ authUnsubscribe: subscription?.unsubscribe })
  },

  setupTokenRefreshListener: () => {
    let consecutiveNullSessions = 0

    const checkSessionInterval = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        const currentUser = get().user

        if (error) {
          consecutiveNullSessions = 0
          return
        }

        if (session?.user && !currentUser) {
          consecutiveNullSessions = 0
          set({ user: session.user })
          await get().loadProfile(session.user.id)
        } else if (!session?.user && currentUser) {
          consecutiveNullSessions++
          if (consecutiveNullSessions >= 3) {
            consecutiveNullSessions = 0
            set({ user: null, profile: null, wallet: null })
          }
        } else {
          consecutiveNullSessions = 0
        }
      } catch (err) {
        console.error('Token refresh check error:', err)
      }
    }, 60000)

    return () => clearInterval(checkSessionInterval)
  },

  loadProfile: async (userId) => {
    if (get().isLoadingProfile) return
    set({ isLoadingProfile: true })
    try {
      let profile, wallet
      try {
        ;({ data: profile } = await withTimeout(
          supabase.from('users').select('*').eq('id', userId).single(),
          8000
        ))
      } catch {
        profile = null
      }

      try {
        ;({ data: wallet } = await withTimeout(
          supabase.from('wallets').select('*').eq('user_id', userId).single(),
          8000
        ))
      } catch {
        wallet = null
      }

      set({ profile, wallet })
    } catch (err) {
      console.error('loadProfile error:', err)
    } finally {
      set({ isLoadingProfile: false })
    }
  },

  refreshWallet: async () => {
    const user = get().user
    if (!user) return
    try {
      const { data: wallet } = await withTimeout(
        supabase.from('wallets').select('*').eq('user_id', user.id).single(),
        8000
      )
      set({ wallet })
    } catch (err) {
      console.error('refreshWallet error:', err.message)
    }
  },

  signUp: async (email, password, userData) => {
    const authEmail = email && email.trim()
      ? email.trim()
      : `${(userData.telefono || userData.rif || 'user').replace(/\D/g, '')}@solutechquiniela.app`

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: { nombre: userData.nombre, rif: userData.rif } }
    })
    if (authError) throw authError

    const { error: rpcError } = await supabase.rpc('register_profile', {
      p_rif: userData.rif,
      p_nombre: userData.nombre,
      p_telefono: userData.telefono,
      p_empresa: userData.empresa || '',
      p_zona: userData.zona || '',
      p_vendedor: userData.vendedor || '',
      p_puntos: userData.puntosIniciales || 0,
    })
    if (rpcError) throw rpcError

    set({ user: authData.user })
    await get().loadProfile(authData.user.id)
    return authData
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user })
    await get().loadProfile(data.user.id)
    return data
  },

  signInWithRif: async (rif, password) => {
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('get_email_by_rif', { p_rif: rif })

    if (rpcError) {
      console.error('[signInWithRif] RPC error:', rpcError)
      throw new Error('Error verificando la cédula. Intenta de nuevo.')
    }

    const email = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult

    if (!email) {
      throw new Error('No encontramos una cuenta asociada a esa cédula. Regístrate primero.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[signInWithRif] signIn error:', error, 'email usado:', email)
      throw error
    }

    set({ user: data.user })
    await get().loadProfile(data.user.id)
    return data
  },

  signOut: async () => {
    try {
      useMatchStore.getState().stopLivePolling()
    } catch {
      // ignore — matchStore may not be initialized
    }
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('SignOut error:', err)
    }
    set({ user: null, profile: null, wallet: null, loading: false, initialized: true })
    window.location.href = '/login'
    window.location.reload()
  },
}))
