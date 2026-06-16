import { NavLink } from 'react-router-dom'
import { Home, Trophy, Ticket, Wallet, BarChart3, User } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/partidos', icon: Trophy, label: 'Partidos' },
  { to: '/mis-apuestas', icon: Ticket, label: 'Mis Jugadas' },
  { to: '/wallet', icon: Wallet, label: 'Mis Puntos' },
  { to: '/ranking', icon: BarChart3, label: 'Ranking' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-iron-900 border-t border-iron-200 dark:border-iron-700 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg transition-colors
              ${isActive
                ? 'text-primary-500 dark:text-primary-400'
                : 'text-iron-400 dark:text-iron-500 hover:text-iron-600 dark:hover:text-iron-300'
              }
            `}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
