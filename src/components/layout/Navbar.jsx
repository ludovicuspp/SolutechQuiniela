import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Shield, Wallet } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { formatPoints, timeFromNow } from '../../utils/formatters'

export default function Navbar() {
  const { profile, wallet } = useAuthStore()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  const [showNotifs, setShowNotifs] = useState(false)
  const notifsRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (notifsRef.current && !notifsRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-iron-900/80 backdrop-blur-xl border-b border-iron-200 dark:border-iron-700">
      <div className="relative flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {profile?.is_admin && (
            <Link
              to="/admin"
              className="p-2 rounded-lg hover:bg-iron-100 dark:hover:bg-iron-800 text-primary-500 transition-colors"
              title="Panel de Administracion"
            >
              <Shield size={20} />
            </Link>
          )}
          {wallet && (
            <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-accent-50 to-accent-100 dark:from-accent-600/20 dark:to-accent-500/10 px-4 py-2 rounded-xl border border-accent-200 dark:border-accent-600/30">
              <Wallet size={18} className="text-accent-500" />
              <span className="font-bold text-accent-600 dark:text-accent-300">
                {formatPoints(wallet.balance)}
              </span>
              <span className="text-xs text-accent-500 dark:text-accent-400">pts</span>
            </div>
          )}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img
            src="/utils/SOLUTECH-02.png"
            alt="IronPlay"
            className="h-10 object-contain invert dark:invert-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notifsRef}>
            <button onClick={() => setShowNotifs(!showNotifs)}
              className="p-2 rounded-lg hover:bg-iron-100 dark:hover:bg-iron-800 text-iron-500 dark:text-iron-400 transition-colors relative">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-iron-800 rounded-xl shadow-xl border border-iron-200 dark:border-iron-700 overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between p-3 border-b border-iron-200 dark:border-iron-700">
                  <h3 className="font-semibold text-iron-900 dark:text-white text-sm">Notificaciones</h3>
                  {unreadCount > 0 && (
                    <button onClick={() => markAllAsRead(profile?.id)}
                      className="text-xs text-primary-500 hover:text-primary-600">
                      Marcar todas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-iron-400 text-sm">Sin notificaciones</p>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 border-b border-iron-100 dark:border-iron-700/50 cursor-pointer hover:bg-iron-50 dark:hover:bg-iron-700/50 transition-colors ${!n.leida ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}>
                        <p className="text-sm font-medium text-iron-900 dark:text-white">{n.titulo}</p>
                        <p className="text-xs text-iron-500 dark:text-iron-400 mt-0.5">{n.mensaje}</p>
                        <p className="text-xs text-iron-400 mt-1">{timeFromNow(n.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
