import { useEffect } from 'react'
import { Ticket, Trophy, TrendingDown, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useBetStore } from '../store/betStore'
import { formatPoints, formatDateTime } from '../utils/formatters'
import { Flag } from '../utils/countries'


export default function MyBetsPage() {
  const { profile } = useAuthStore()
  const { myBets, loading, fetchMyBets, getStats } = useBetStore()

  // Refetch cada vez que se monta la página (cada visita)
  useEffect(() => {
    if (profile?.id) fetchMyBets(profile.id)
  }, [])

  const stats = getStats()

  const getPrediccionText = (bet) => {
    const p = bet.prediccion
    if (bet.tipo_apuesta === 'ganador') {
      if (p.resultado === 'local')     return `Ganador: ${bet.matches?.equipo_local}`
      if (p.resultado === 'visitante') return `Ganador: ${bet.matches?.equipo_visitante}`
      return 'Empate'
    }
    if (bet.tipo_apuesta === 'empate') {
      return 'Empate'
    }
    if (bet.tipo_apuesta === 'resultado_exacto') {
      return `Resultado Exacto: ${p.goles_local} - ${p.goles_visitante}`
    }
    return ''
  }

  const getPrediccionValue = (bet) => {
    const p = bet.prediccion
    if (bet.tipo_apuesta === 'ganador') {
      if (p.resultado === 'local')     return bet.matches?.equipo_local
      if (p.resultado === 'visitante') return bet.matches?.equipo_visitante
      return 'Empate'
    }
    if (bet.tipo_apuesta === 'resultado_exacto') {
      return `${p.goles_local} - ${p.goles_visitante}`
    }
    return ''
  }

  const getBetTypeBadge = (bet) => {
    const labels = { ganador: 'Ganador', empate: 'Empate', resultado_exacto: 'Resultado' }
    return labels[bet.tipo_apuesta] || bet.tipo_apuesta
  }

  const isEmpateOld = (bet) =>
    bet.tipo_apuesta === 'ganador' && bet.prediccion?.resultado === 'empate'

  const isEmpate = (bet) =>
    bet.tipo_apuesta === 'empate' || isEmpateOld(bet)

  const estadoIcon = (estado) => {
    if (estado === 'ganada') return <Trophy size={16} className="text-success" />
    if (estado === 'perdida') return <TrendingDown size={16} className="text-danger" />
    return <Clock size={16} className="text-accent-400" />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
        <Ticket size={24} className="text-primary-500" />
        Mis Jugadas
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-iron-900 dark:text-white">{stats.total}</p>
          <p className="text-xs text-iron-500 mt-1">Total</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-success">{stats.ganadas}</p>
          <p className="text-xs text-iron-500 mt-1">Ganadas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-danger">{stats.perdidas}</p>
          <p className="text-xs text-iron-500 mt-1">Perdidas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-400">{stats.pendientes}</p>
          <p className="text-xs text-iron-500 mt-1">Pendientes</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : myBets.length === 0 ? (
        <div className="card text-center py-12">
          <Ticket size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
          <h3 className="text-lg font-bold text-iron-900 dark:text-white">Sin jugadas aun</h3>
          <p className="text-iron-500 dark:text-iron-400 mt-2">
            Ve a la sección de Partidos para realizar tu primer pronóstico
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myBets.map(bet => (
            <div key={bet.id} className="card flex flex-col gap-4">
              {/* PARTE SUPERIOR: Centrada (Equipos, Predicción, Fecha) */}
              <div className="flex flex-col items-center text-center gap-2">
                {/* Ícono de estado */}
                <div className="flex justify-center">
                  {estadoIcon(bet.estado)}
                </div>

                {/* Equipos con banderas - CENTRADO */}
                <p className="font-semibold text-iron-900 dark:text-white text-sm">
                  {bet.matches ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Flag country={bet.matches.equipo_local} size={16} />
                      <span>{bet.matches.equipo_local} vs {bet.matches.equipo_visitante}</span>
                      <Flag country={bet.matches.equipo_visitante} size={16} />
                    </span>
                  ) : 'Partido'}
                </p>

                {/* Tipo de Pronóstico y Predicción - CENTRADO */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-xs text-iron-500 dark:text-iron-400">
                    {getBetTypeBadge(bet)}:
                  </span>
                  {isEmpate(bet) ? (
                    <span className="text-xs font-bold text-iron-600 dark:text-iron-200">
                      Empate
                    </span>
                  ) : (
                    <span className="font-semibold text-sm text-iron-900 dark:text-white">
                      {getPrediccionValue(bet)}
                    </span>
                  )}
                </div>

                {/* Fecha del Partido - CENTRADO */}
                <p className="text-xs text-iron-400">{formatDateTime(bet.created_at)}</p>
              </div>

              {/* PARTE INFERIOR: Footer con monto, multiplicador y badge */}
              <div className="flex items-center justify-around gap-2 pt-2 border-t border-iron-200 dark:border-iron-700">
                <div className="text-center flex-1">
                  <p className="text-xs text-iron-500">Jugado</p>
                  <p className="font-bold text-iron-900 dark:text-white text-sm">{formatPoints(bet.monto)}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-iron-500">x{bet.multiplicador}</p>
                  <p className="font-bold text-accent-500 text-sm">{formatPoints(bet.ganancia_potencial)}</p>
                </div>
                <div className="flex-1 flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    bet.estado === 'ganada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    bet.estado === 'perdida' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {bet.estado}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
