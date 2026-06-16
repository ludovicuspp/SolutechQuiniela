import { useNavigate } from 'react-router-dom'
import { Headphones } from 'lucide-react'

export default function SupportFab() {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/soporte')}
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg border border-primary-500/40 bg-iron-900/90 dark:bg-iron-950/90 text-white backdrop-blur-sm hover:bg-iron-800/90 dark:hover:bg-iron-900/90 transition-all active:scale-95"
      title="Soporte"
    >
      <Headphones size={20} className="text-primary-400 shrink-0" />
      <span className="text-sm font-semibold text-primary-300">Soporte</span>
    </button>
  )
}
