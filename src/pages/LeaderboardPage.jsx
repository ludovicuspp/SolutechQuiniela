import { useEffect, useState } from 'react'
import { BarChart3, Crown, Medal, Award, Trophy, Gift, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useAdminStore } from '../store/useAdminStore'
import { formatPoints } from '../utils/formatters'
import toast from 'react-hot-toast'

// ✅ Función helper para sufijos de posición
const getPositionSuffix = (posicion) => {
  if (posicion === 1) return '🥇'
  if (posicion === 2) return '🥈'
  if (posicion === 3) return '🥉'
  return `#${posicion}:`
}

const FASES = [
  { id: 'grupo',        label: 'Grupos' },
  { id: 'octavos',      label: 'Octavos' },
  { id: 'cuartos',      label: 'Cuartos' },
  { id: 'semifinal',    label: 'Semifinal' },
  { id: 'tercer_puesto',label: 'Tercer Puesto' },
  { id: 'final',        label: 'Final' },
]

export default function LeaderboardPage() {
  const { profile } = useAuthStore()
  const { prizeWinners, isLoadingWinners, isAssigningPrizes, fetchPrizeWinners, assignPhasePrizes } = useAdminStore()
  const isAdmin = profile?.is_admin

  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  
  // ✅ Estado para las pestañas
  const [activeTab, setActiveTab] = useState('clasificacion')
  
  // ✅ Estado para premios desde Supabase
  const [premios, setPremios] = useState([])
  const [loadingPremios, setLoadingPremios] = useState(false)

  // Refetch cada vez que se monta la página
  useEffect(() => {
    if (profile?.id) fetchLeaderboard()
  }, [])

  // ✅ Cargar premios cuando se abre la pestaña
  useEffect(() => {
    if (activeTab === 'premios' && premios.length === 0) {
      fetchPremios()
    }
    if (activeTab === 'ganadores') {
      fetchPrizeWinners()
    }
  }, [activeTab])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      // ✅ Lee de la vista pública leaderboard (sin exponer PII de users).
      // La vista ya excluye admins y entrega la posición calculada.
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_won', { ascending: false })
        .limit(100)

      if (error) {
        console.error('[fetchLeaderboard] Error Supabase:', error.message)
        // No borrar datos existentes en error de red — mantener último ranking conocido
        return
      }

      const rankingData = (data || []).map((row, index) => ({
        id: row.id,
        alias: row.alias || 'Jugador Anónimo',
        total_won: row.total_won,
        balance: row.balance,
        total_wagered: row.total_wagered,
        total_earned: row.total_earned,
        posicion: index + 1,
      }))

      setRanking(rankingData)
    } catch (err) {
      console.error('[fetchLeaderboard] Exception:', err.message)
      // No borrar datos existentes en error de red
    } finally {
      setLoading(false)
    }
  }

  // ✅ Cargar premios desde Supabase
  const fetchPremios = async () => {
    setLoadingPremios(true)
    try {
      const { data } = await supabase
        .from('prizes')
        .select('*')
        .order('fase', { ascending: true })
        .order('posicion', { ascending: true })
      setPremios(data || [])
    } catch (err) {
      console.error('[fetchPremios] error:', err)
    } finally {
      setLoadingPremios(false)
    }
  }

  const handleAssignPrizes = async (fase) => {
    const result = await assignPhasePrizes(fase)
    if (result.success) {
      toast.success(`Premios de ${fase} asignados correctamente`)
    } else {
      toast.error(`Error: ${result.error}`)
    }
  }

  const getPosIcon = (pos) => {
    if (pos === 1) return <Crown size={20} className="text-yellow-400" />
    if (pos === 2) return <Medal size={20} className="text-gray-400" />
    if (pos === 3) return <Award size={20} className="text-amber-600" />
    return <span className="w-5 text-center text-sm font-bold text-iron-500">{pos}</span>
  }

  const getRowStyle = (pos, userId) => {
    const isMe = userId === profile?.id
    if (pos <= 5) {
      const colors = {
        1: 'bg-gradient-to-r from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-900/10 border-yellow-200 dark:border-yellow-800/50',
        2: 'bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-800/20 border-gray-200 dark:border-gray-700',
        3: 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800/50',
        4: 'border-iron-200 dark:border-iron-700',
        5: 'border-iron-200 dark:border-iron-700',
      }
      return `${colors[pos] || ''} ${isMe ? 'ring-2 ring-primary-500' : ''}`
    }
    return isMe ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-700' : 'border-iron-200 dark:border-iron-700'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
        <BarChart3 size={24} className="text-accent-400" />
        Ranking
      </h1>

      {/* ✅ Interfaz de Pestañas */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('clasificacion')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'clasificacion'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-white dark:bg-iron-800 text-iron-600 dark:text-iron-400 hover:bg-iron-100 dark:hover:bg-iron-700 border border-iron-200 dark:border-iron-700'
          }`}>
          📊 Clasificación
        </button>
        <button 
          onClick={() => setActiveTab('premios')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'premios'
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-white dark:bg-iron-800 text-iron-600 dark:text-iron-400 hover:bg-iron-100 dark:hover:bg-iron-700 border border-iron-200 dark:border-iron-700'
          }`}>
          🏆 Premios
        </button>
        <button 
          onClick={() => setActiveTab('ganadores')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeTab === 'ganadores'
              ? 'bg-yellow-500 text-white shadow-md'
              : 'bg-white dark:bg-iron-800 text-iron-600 dark:text-iron-400 hover:bg-iron-100 dark:hover:bg-iron-700 border border-iron-200 dark:border-iron-700'
          }`}>
          🥇 Ganadores
        </button>
      </div>

      {/* ✅ CONTENIDO DE CLASIFICACIÓN */}
      {activeTab === 'clasificacion' && (
        <>
                    {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : ranking.length === 0 ? (
            <div className="card text-center py-12">
              <BarChart3 size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
              <h3 className="text-lg font-bold text-iron-900 dark:text-white">Sin participantes aun</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {ranking.map(player => (
            <div key={player.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${getRowStyle(player.posicion, player.id)}`}>
              <div className="w-8 flex justify-center shrink-0">
                {getPosIcon(player.posicion)}
              </div>

              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">
                  {player.alias?.charAt(0) || '?'}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-iron-900 dark:text-white text-sm truncate">
                  {player.alias}
                  {player.id === profile?.id && (
                    <span className="ml-2 text-xs text-primary-500 font-normal">(Tú)</span>
                  )}
                </p>
              </div>

              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-iron-500 font-medium">Saldo</p>
                <p className="font-semibold text-iron-900 dark:text-white">
                  {formatPoints(Number(player.balance))} pts
                </p>
              </div>

              <div className="text-right shrink-0">
                {/* ✅ CRITERIO PRINCIPAL DE RANKING: total_won */}
                <p className="text-xs font-bold text-fifa-green/80 uppercase tracking-wide">Para Ranking</p>
                <p className="font-bold text-fifa-green text-lg">
                  {formatPoints(Number(player.total_won))}
                </p>
              </div>
            </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ✅ CONTENIDO DE GANADORES */}
      {activeTab === 'ganadores' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
              <Star size={22} className="text-yellow-400" />
              Ganadores por Fase
            </h2>
          </div>

          {/* Botones de admin para asignar premios */}
          {isAdmin && (
            <div className="card p-4 border-yellow-400/30 bg-yellow-50/10">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide mb-3">Admin: Asignar Premios</p>
              <div className="flex flex-wrap gap-2">
                {FASES.map(fase => (
                  <button
                    key={fase.id}
                    onClick={() => handleAssignPrizes(fase.id)}
                    disabled={isAssigningPrizes}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 disabled:opacity-50 transition-all"
                  >
                    {isAssigningPrizes ? '...' : `Asignar ${fase.label}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoadingWinners ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : prizeWinners.length === 0 ? (
            <div className="card text-center py-12">
              <Star size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
              <h3 className="text-lg font-bold text-iron-900 dark:text-white">Sin ganadores asignados aun</h3>
              <p className="text-sm text-iron-500 mt-1">Los ganadores se asignan al finalizar cada fase</p>
            </div>
          ) : (
            <div className="space-y-6">
              {FASES.map(fase => {
                const ganadoresFase = prizeWinners.filter(w => w.fase === fase.id).sort((a, b) => a.posicion - b.posicion)
                if (ganadoresFase.length === 0) return null

                return (
                  <div key={fase.id} className="card p-5">
                    <h3 className="font-bold text-iron-900 dark:text-white mb-4 flex items-center gap-2">
                      <Trophy size={16} className="text-yellow-400" />
                      {fase.label}
                    </h3>
                    <div className="space-y-3">
                      {ganadoresFase.map(winner => {
                        const medals = { 1: '🥇', 2: '🥈', 3: '🥉' }
                        return (
                          <div key={winner.id} className="flex items-center gap-3 p-3 rounded-xl bg-iron-50 dark:bg-iron-800/50">
                            <span className="text-2xl w-8 text-center">{medals[winner.posicion] || `#${winner.posicion}`}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-iron-900 dark:text-white text-sm truncate">
                                {winner.usuario_alias || 'Jugador Anónimo'}
                                {winner.user_id === profile?.id && (
                                  <span className="ml-2 text-xs text-primary-500">(Tú)</span>
                                )}
                              </p>
                            </div>
                            {winner.premio_titulo && (
                              <div className="text-right shrink-0">
                                <p className="text-xs font-medium text-yellow-500">{winner.premio_titulo}</p>
                                {winner.premio_descripcion && (
                                  <p className="text-xs text-iron-400 max-w-[120px] truncate">{winner.premio_descripcion}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

       {/* ✅ CONTENIDO DE PREMIOS */}
       {activeTab === 'premios' && (
         <div>
           <h2 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-3 mb-6">
             <Trophy size={28} className="text-yellow-500" />
              🏆 Premios Oficiales SolutechQuiniela
           </h2>

           {loadingPremios ? (
             <div className="flex justify-center py-12">
               <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
             </div>
           ) : premios.length === 0 ? (
             <div className="card text-center py-12">
               <Trophy size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
               <h3 className="text-lg font-bold text-iron-900 dark:text-white">Sin premios registrados</h3>
             </div>
           ) : (
              <div className="space-y-6">
                {/* Agrupar premios por corte */}
                {[
                  { id: 'Corte 1', label: 'Corte 1',  sub: 'Al finalizar la Ronda de 32', color: 'from-blue-500 to-blue-600',     border: 'border-blue-400 dark:border-blue-600' },
                  { id: 'Corte 2', label: 'Corte 2',  sub: 'Al finalizar Octavos',         color: 'from-purple-500 to-purple-600', border: 'border-purple-400 dark:border-purple-600' },
                  { id: 'Corte 3', label: 'Corte 3',  sub: 'Al finalizar Cuartos',         color: 'from-orange-500 to-orange-600', border: 'border-orange-400 dark:border-orange-600' },
                  { id: 'Corte 4', label: 'Corte 4',  sub: 'Final del Mundial',            color: 'from-yellow-400 to-red-500',   border: 'border-yellow-400 dark:border-yellow-600' },
                ].map(corte => {
                  const premiosCorte = premios.filter(p => p.fase === corte.id).sort((a, b) => a.posicion - b.posicion)
                  if (premiosCorte.length === 0) return null

                  return (
                    <div
                      key={corte.id}
                      className={`rounded-2xl p-6 border-2 ${corte.border} shadow-lg hover:shadow-xl transition-all overflow-hidden relative group`}
                      style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)' }}
                    >
                      {/* Fondo gradiente sutil */}
                      <div className={`absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br ${corte.color} opacity-5 rounded-full group-hover:opacity-10 transition-opacity`} />

                      {/* Encabezado */}
                      <div className="relative z-10 flex items-center gap-3 mb-4">
                        <div className={`bg-gradient-to-br ${corte.color} p-3 rounded-xl`}>
                          <Trophy size={20} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">🏆 {corte.label}</h3>
                          <p className="text-xs text-iron-400 mt-0.5">{corte.sub}</p>
                        </div>
                      </div>

                      {/* Lista de premios ordenados por posición */}
                      <div className="relative z-10 space-y-2.5 mt-5">
                        {premiosCorte.map(premio => (
                          <div
                            key={premio.id}
                            className="flex items-start gap-3 p-2.5 rounded-lg bg-iron-800/40 hover:bg-iron-800/60 transition-colors group/item"
                          >
                            <span className="text-sm font-bold text-yellow-400 flex-shrink-0">
                              {getPositionSuffix(premio.posicion)}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm text-iron-200 group-hover/item:text-white transition-colors font-medium">
                                {premio.titulo}
                              </p>
                              {premio.descripcion && (
                                <p className="text-xs text-iron-400 mt-1">{premio.descripcion}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
             </div>
           )}
         </div>
       )}
    </div>
  )
}
