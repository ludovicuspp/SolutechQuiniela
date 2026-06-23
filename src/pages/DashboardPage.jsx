import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Wallet, TrendingUp, Target, ArrowRight, Calendar, Zap } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useMatchStore } from '../store/matchStore'
import { useBetStore } from '../store/betStore'
import { formatPoints } from '../utils/formatters'
import { Flag } from '../utils/countries'
import MatchCard from '../components/matches/MatchCard'
import SupportFab from '../components/layout/SupportFab'

export default function DashboardPage() {
  const { profile, wallet } = useAuthStore()
  const { allMatches: matches = [], refetchMatches, getUpcomingMatches, getRecentResults, getLiveMatches } = useMatchStore()
  const { myBets, fetchMyBets, getStats, hasBetOnMatch } = useBetStore()

  // Refetch al montar (cada visita al dashboard)
  useEffect(() => {
    refetchMatches()
    if (profile?.id) fetchMyBets(profile.id)
  }, [])

  const stats = getStats()
  const todayMatches = getUpcomingMatches()
  const liveMatches = getLiveMatches()
  const results = getRecentResults()

  const statCards = [
    {
      icon: Wallet, label: 'Saldo Disponible', value: formatPoints(wallet?.balance || 0), suffix: 'pts',
      color: 'from-fifa-blue to-fifa-blue-dark', iconColor: 'text-fifa-blue',
      bgIcon: 'bg-fifa-blue/20',
      sublabel: '(para apostar hoy)',
    },
    {
      icon: TrendingUp, label: 'Puntos p/ Ranking', value: formatPoints(wallet?.total_won || 0), suffix: 'pts',
      color: 'from-fifa-green to-fifa-green-dark', iconColor: 'text-fifa-green',
      bgIcon: 'bg-fifa-green/20',
      sublabel: '(criterio de clasificación)',
    },
    {
      icon: Target, label: 'Jugadas Ganadas', value: `${stats.ganadas}/${stats.total}`,
      color: 'from-fifa-orange to-fifa-orange-dark', iconColor: 'text-fifa-orange',
      bgIcon: 'bg-fifa-orange/20',
    },
    {
      icon: Zap, label: 'Total Jugado', value: formatPoints(stats.totalApostado), suffix: 'pts',
      color: 'from-fifa-purple to-fifa-purple-dark', iconColor: 'text-fifa-purple',
      bgIcon: 'bg-fifa-purple/20',
      sublabel: '(histórico)',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-iron-900 dark:text-white">
          Hola, {profile?.nombre?.split(' ')[0] || 'Usuario'}!
        </h1>
        <p className="text-iron-500 dark:text-iron-400 mt-1">
          Bienvenido a SolutechQuiniela
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon: Icon, label, value, suffix, color, iconColor, bgIcon, sublabel }) => (
          <div key={label} className={`bg-gradient-to-br ${color} rounded-2xl p-4 lg:p-5 text-white relative overflow-hidden`}>
            <div className={`absolute -right-2 -bottom-2 w-20 h-20 ${bgIcon} rounded-full opacity-40`} />
            <div className={`absolute right-3 bottom-3 ${iconColor} opacity-30`}>
              <Icon size={56} />
            </div>
            <p className="text-xs lg:text-sm font-medium opacity-90">{label}</p>
            {sublabel && <p className="text-xs font-normal opacity-70 mt-0.5">{sublabel}</p>}
            <p className="text-xl lg:text-2xl font-bold mt-1">
              {value}
              {suffix && <span className="text-sm font-normal opacity-70 ml-1">{suffix}</span>}
            </p>
          </div>
        ))}
      </div>

        {liveMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-iron-900 dark:text-white flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                En Vivo
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

       {todayMatches.length > 0 && (
         <section>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-bold text-iron-900 dark:text-white flex items-center gap-2">
               <Calendar size={20} className="text-primary-500" />
                Próximos Partidos
             </h2>
            <Link to="/partidos" className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayMatches.map(match => (
              <MatchCard key={match.external_id || match.id} match={match} hasBetted={hasBetOnMatch(match.external_id)} />
            ))}
          </div>
        </section>
        )}

        {todayMatches.length === 0 && matches.length > 0 && (
         <div className="card text-center py-8">
           <Calendar size={40} className="mx-auto text-iron-300 dark:text-iron-600 mb-3" />
            <h3 className="text-base font-bold text-iron-700 dark:text-iron-300">
               No hay partidos disponibles para pronosticar
            </h3>
           <p className="text-iron-500 dark:text-iron-400 mt-1 text-sm">
             Vuelve pronto para ver los próximos encuentros!
           </p>
         </div>
       )}

       {results.length > 0 && (
         <section>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-bold text-iron-900 dark:text-white flex items-center gap-2">
               <Trophy size={20} className="text-accent-400" />
               Resultados Recientes
             </h2>
           </div>
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
             {results.map(match => (
               <MatchCard key={match.id} match={match} compact />
             ))}
           </div>
         </section>
       )}

       {matches.length === 0 && (
         <div className="card text-center py-12">
           <Trophy size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
           <h3 className="text-lg font-bold text-iron-900 dark:text-white">
             Esperando partidos del Mundial 2026
           </h3>
           <p className="text-iron-500 dark:text-iron-400 mt-2 max-w-md mx-auto">
             Los partidos se cargaran automaticamente cuando comience el torneo.
             Mientras tanto, tus compras en Solutech siguen sumando puntos!
           </p>
         </div>
       )}

       {myBets.length > 0 && (
         <section>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-bold text-iron-900 dark:text-white">
               Últimas Jugadas
             </h2>
             <Link to="/mis-apuestas" className="text-sm text-primary-500 hover:text-primary-600 flex items-center gap-1">
               Ver todas <ArrowRight size={14} />
             </Link>
           </div>
           <div className="card overflow-x-auto">
             <table className="w-full text-sm">
               <thead>
                 <tr className="text-left text-iron-500 dark:text-iron-400 border-b border-iron-200 dark:border-iron-700">
                   <th className="pb-2 font-medium">Partido</th>
                   <th className="pb-2 font-medium">Tipo</th>
                   <th className="pb-2 font-medium">Monto</th>
                   <th className="pb-2 font-medium">Estado</th>
                 </tr>
               </thead>
               <tbody>
                 {myBets.slice(0, 5).map(bet => (
                   <tr key={bet.id} className="border-b border-iron-100 dark:border-iron-700/50">
                     <td className="py-2">
                       {bet.matches ? (
                         <span className="inline-flex items-center gap-1.5">
                           <Flag country={bet.matches.equipo_local} size={20} />
                           <span>{bet.matches.equipo_local}</span>
                           <span className="text-iron-400 mx-1">vs</span>
                           <span>{bet.matches.equipo_visitante}</span>
                           <Flag country={bet.matches.equipo_visitante} size={20} />
                         </span>
                       ) : 'Partido'}
                     </td>
                     <td className="py-2 capitalize">{bet.tipo_apuesta.replace('_', ' ')}</td>
                     <td className="py-2 font-medium">{formatPoints(bet.monto)} pts</td>
                     <td className="py-2">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                         bet.estado === 'ganada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                         bet.estado === 'perdida' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                       }`}>
                         {bet.estado}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </section>
       )}

       <SupportFab />
    </div>
  )
}
