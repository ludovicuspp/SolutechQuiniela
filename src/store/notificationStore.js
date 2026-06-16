import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (userId) => {
    if (!userId) return
    if (get().isLoading) return
    console.log('[notifications] fetchNotifications start, userId:', userId)
    set({ isLoading: true })
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      const notifs = data || []
      set({
        notifications: notifs,
        unreadCount: notifs.filter(n => !n.leida).length,
      })
      console.log('[notifications] fetchNotifications done, count:', notifs.length)
    } catch (err) {
      console.error('[notifications] fetchNotifications error:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  markAsRead: async (id) => {
    await supabase.from('notifications').update({ leida: true }).eq('id', id)
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, leida: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllAsRead: async (userId) => {
    await supabase.from('notifications')
      .update({ leida: true })
      .eq('user_id', userId)
      .eq('leida', false)
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, leida: true })),
      unreadCount: 0,
    }))
  },

  subscribeToNotifications: (userId) => {
    console.log('[notifications] subscribeToNotifications, userId:', userId)
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        set(state => ({
          notifications: [payload.new, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  },
}))
