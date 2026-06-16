import { useEffect } from 'react'
import { Trophy, Clock, MapPin, Lock } from 'lucide-react'
import { useMatchStore } from '../store/matchStore'
import { getCountryCode } from '../utils/countries'
import { getFaseLabel } from '../utils/formatters'
import MatchCard from '../components/matches/MatchCard'

const FASES = [
  { id: 'todos', label: 'Todos' },
  { id: 'grupo', label: 'Grupos' },
  { id: 'dieciseisavos', label: 'Dieciseisavos' },
  { id: 'octavos', label: 'Octavos' },
  { id: 'cuartos', label: 'Cuartos' },
  { id: 'semifinal', label: 'Semis' },
  { id: 'final', label: 'Final' },
  { id: 'finalizados', label: '✅ Finalizados' },
]

function isPlaceholderMatch(match) {
  return !getCountryCode(match.equipo_local) && !getCountryCode(match.equipo_visitante)
}

function PendingPhaseCard({ fase, matchCount, sede }) {
  return (
    <div className="card border-dashed border-2 border-iron-300 dark:border-iron-600 bg-iron-50/50 dark:bg-iron-800/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-iron-200 dark:bg-iron-700 text-iron-500 dark:text-iron-400">
          {getFaseLabel(fase)}
        </span>
        <Lock size={14} className="text-iron-400" />
      </div>
      <div className="flex items-center justify-center py-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="w-10 h-8 rounded bg-iron-200 dark:bg-iron-700 flex items-center justify-center text-iron-400 text-xs font-bold">?</span>
            <span className="text-iron-400 font-bold text-lg">VS</span>
            <span className="w-10 h-8 rounded bg-iron-200 dark:bg-iron-700 flex items-center justify-center text-iron-400 text-xs font-bold">?</span>
          </div>
          <p className="text-sm text-iron-400 dark:text-iron-500 font-medium">
            Por definir
          </p>
        </div>
      </div>
      {sede && (
        <div className="mt-2 pt-2 border-t border-iron-200 dark:border-iron-700">
          <span className="flex items-center gap-1 text-xs text-iron-400">
            <MapPin size={12} /> {sede}
          </span>
        </div>
      )}
    </div>
  )
}

export default function MatchesPage() {
  const { loading, selectedFase, setFase, fetchMatches, allMatches } = useMatchStore()

  useEffect(() => { fetchMatches() }, [])

  // ✅ Filtrar matches según la fase seleccionada
  const getMatches = () => {
    if (selectedFase === 'finalizados') {
      return allMatches.filter(m => m.estado === 'finalizado')
    } else if (selectedFase === 'todos') {
      return allMatches.filter(m => m.estado !== 'finalizado')
    } else {
      return allMatches.filter(m => m.fase === selectedFase && m.estado !== 'finalizado')
    }
  }

  const matches = getMatches()
  const realMatches = matches.filter(m => !isPlaceholderMatch(m))
  const placeholderMatches = matches.filter(m => isPlaceholderMatch(m))
  const allPlaceholder = matches.length > 0 && realMatches.length === 0

  const matchKey = m => m.external_id || m.id

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
          <Trophy size={24} className="text-accent-400" />
          Partidos
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {FASES.map(f => (
          <button key={f.id} onClick={() => setFase(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedFase === f.id
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white dark:bg-iron-800 text-iron-600 dark:text-iron-400 hover:bg-iron-100 dark:hover:bg-iron-700 border border-iron-200 dark:border-iron-700'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
          <h3 className="text-lg font-bold text-iron-900 dark:text-white">
            No hay partidos disponibles
          </h3>
          <p className="text-iron-500 dark:text-iron-400 mt-2">
            Los partidos se cargaran cuando comience el Mundial 2026
          </p>
        </div>
      ) : allPlaceholder ? (
        <div className="card text-center py-12">
          <Clock size={48} className="mx-auto text-iron-300 dark:text-iron-600 mb-4" />
          <h3 className="text-lg font-bold text-iron-900 dark:text-white">
            Esperando resultados de la fase anterior
          </h3>
          <p className="text-iron-500 dark:text-iron-400 mt-2 max-w-md mx-auto">
            Los equipos de esta fase se definiran automaticamente al finalizar los partidos anteriores.
          </p>
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {placeholderMatches.map(match => (
              <PendingPhaseCard
                key={matchKey(match)}
                fase={match.fase}
                matchCount={placeholderMatches.length}
                sede={match.sede}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realMatches.map(match => (
              <MatchCard key={matchKey(match)} match={match} isReadOnly />
            ))}
          </div>

          {placeholderMatches.length > 0 && selectedFase === 'todos' && (
            <div className="mt-8">
              <div className="card text-center py-8 bg-iron-50/50 dark:bg-iron-800/30 border-dashed border-2 border-iron-300 dark:border-iron-600">
                <Lock size={32} className="mx-auto text-iron-300 dark:text-iron-600 mb-3" />
                <h3 className="text-base font-bold text-iron-600 dark:text-iron-400">
                  {placeholderMatches.length} partidos de fases eliminatorias
                </h3>
                <p className="text-iron-400 dark:text-iron-500 text-sm mt-1">
                  Se definiran al finalizar la fase de grupos
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
