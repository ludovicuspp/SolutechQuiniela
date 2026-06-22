import { useState } from 'react'
import { X, Trophy, TrendingUp, Target, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useBetStore, getMultiplier } from '../../store/betStore'
import { formatPoints } from '../../utils/formatters'
import { Flag } from '../../utils/countries'
import toast from 'react-hot-toast'

const BET_TYPES = [
  { id: 'ganador', label: 'Ganador', icon: Trophy, desc: 'Predice quien gana o si empatan' },
  { id: 'empate', label: 'Empate', icon: TrendingUp, desc: 'Predice que terminan empatados' },
  { id: 'resultado_exacto', label: 'Resultado Exacto', icon: Target, desc: 'Predice el marcador exacto del partido' },
]

export default function BetModal({ match, onClose }) {
  const { user, wallet, refreshWallet } = useAuthStore()
  const { placeBet } = useBetStore()
  const [tipo, setTipo] = useState('')
  const [monto, setMonto] = useState('')
  const [prediccion, setPrediccion] = useState({})
  const [loading, setLoading] = useState(false)

  const multiplicador = tipo ? getMultiplier(match.fase, tipo) : 0
  const ganancia = Number(monto) * multiplicador

  const canSubmit = () => {
    if (!tipo || !monto || Number(monto) <= 0) return false
    if (Number(monto) > (wallet?.balance || 0)) return false

    if (tipo === 'ganador') return !!prediccion.resultado
    if (tipo === 'diferencia_goles') return prediccion.diferencia !== undefined && !!prediccion.favor
    if (tipo === 'resultado_exacto') return prediccion.goles_local !== undefined && prediccion.goles_visitante !== undefined
    return false
  }

  const handleSubmit = async () => {
    if (!canSubmit()) return
    setLoading(true)
    try {
      await placeBet(user.id, match, tipo, prediccion, Number(monto))
      await refreshWallet()
      toast.success('¡Pronóstico registrado!')
      onClose()
    } catch (err) {
          toast.error(err.message || 'Error al registrar pronóstico')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-iron-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-iron-200 dark:border-iron-700 animate-slide-up"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-4 border-b border-iron-200 dark:border-iron-700">
          <h2 className="text-lg font-bold text-iron-900 dark:text-white">Nuevo Pronóstico</h2>
          <button onClick={onClose} className="p-1 hover:bg-iron-100 dark:hover:bg-iron-700 rounded-lg">
            <X size={20} className="text-iron-500" />
          </button>
        </div>

        <div className="p-4 bg-iron-50 dark:bg-iron-900/50 flex items-center justify-between">
          <div className="text-center flex-1 flex flex-col items-center">
            <Flag country={match.equipo_local} size={32} />
            <p className="text-sm font-medium text-iron-900 dark:text-white mt-1">{match.equipo_local}</p>
          </div>
          <span className="text-iron-400 font-bold">VS</span>
          <div className="text-center flex-1 flex flex-col items-center">
            <Flag country={match.equipo_visitante} size={32} />
            <p className="text-sm font-medium text-iron-900 dark:text-white mt-1">{match.equipo_visitante}</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
              Tipo de Pronóstico
            </label>
            <div className="grid grid-cols-1 gap-2">
              {BET_TYPES.map(bt => (
                <button key={bt.id} onClick={() => { setTipo(bt.id); setPrediccion({}) }}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    tipo === bt.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-iron-200 dark:border-iron-700 hover:border-iron-300'
                  }`}>
                  <bt.icon size={20} className={tipo === bt.id ? 'text-primary-500' : 'text-iron-400'} />
                  <div>
                    <p className="text-sm font-semibold text-iron-900 dark:text-white">{bt.label}</p>
                    <p className="text-xs text-iron-500">{bt.desc}</p>
                    <p className="text-xs font-bold text-accent-500 mt-0.5">
                      x{getMultiplier(match.fase, bt.id)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {tipo === 'ganador' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
                Quien gana?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'local', label: match.equipo_local },
                  { val: 'empate', label: 'Empate' },
                  { val: 'visitante', label: match.equipo_visitante },
                ].map(opt => (
                  <button key={opt.val}
                    onClick={() => setPrediccion({ resultado: opt.val })}
                    className={`p-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                      prediccion.resultado === opt.val
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-iron-200 dark:border-iron-700 text-iron-700 dark:text-iron-300 hover:border-iron-300'
                    }`}>
                    {opt.val !== 'empate' && <span className="block mb-1 flex justify-center"><Flag country={opt.label} size={24} /></span>}
                    <span className="truncate block">{opt.val === 'empate' ? 'Empate' : opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipo === 'diferencia_goles' && (
            <div className="animate-fade-in space-y-3">
              <div>
                <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
                  A favor de
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'local', label: match.equipo_local },
                    { val: 'empate', label: 'Empate (0)' },
                    { val: 'visitante', label: match.equipo_visitante },
                  ].map(opt => (
                    <button key={opt.val}
                      onClick={() => setPrediccion(p => ({
                        ...p,
                        favor: opt.val,
                        diferencia: opt.val === 'empate' ? 0 : (p.diferencia || 1)
                      }))}
                      className={`p-2 rounded-xl border-2 text-center text-xs font-medium transition-all ${
                        prediccion.favor === opt.val
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-iron-200 dark:border-iron-700 hover:border-iron-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {prediccion.favor && prediccion.favor !== 'empate' && (
                <div>
                  <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
                    Diferencia de goles
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n}
                        onClick={() => setPrediccion(p => ({ ...p, diferencia: n }))}
                        className={`w-10 h-10 rounded-xl border-2 font-bold transition-all ${
                          prediccion.diferencia === n
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                            : 'border-iron-200 dark:border-iron-700 hover:border-iron-300'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tipo === 'resultado_exacto' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
                Marcador exacto
              </label>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center flex flex-col items-center">
                  <Flag country={match.equipo_local} size={24} />
                  <p className="text-xs text-iron-500 mb-2 truncate max-w-[80px]">{match.equipo_local}</p>
                  <input type="number" min="0" max="20"
                    value={prediccion.goles_local ?? ''}
                    onChange={e => setPrediccion(p => ({ ...p, goles_local: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 text-center text-2xl font-bold input-field" />
                </div>
                <span className="text-2xl font-bold text-iron-400 mt-6">-</span>
                <div className="text-center flex flex-col items-center">
                  <Flag country={match.equipo_visitante} size={24} />
                  <p className="text-xs text-iron-500 mb-2 truncate max-w-[80px]">{match.equipo_visitante}</p>
                  <input type="number" min="0" max="20"
                    value={prediccion.goles_visitante ?? ''}
                    onChange={e => setPrediccion(p => ({ ...p, goles_visitante: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 text-center text-2xl font-bold input-field" />
                </div>
              </div>
            </div>
          )}

          {tipo && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-2">
                Puntos a jugar
              </label>
              <input type="number" min="1" max={wallet?.balance || 0} step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                className="input-field"
                placeholder={`Max: ${formatPoints(wallet?.balance || 0)}`} />
              <div className="flex gap-2 mt-2">
                {[10, 25, 50, 100].map(pct => {
                  const val = ((wallet?.balance || 0) * pct / 100).toFixed(2)
                  return (
                    <button key={pct} onClick={() => setMonto(val)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-iron-300 dark:border-iron-600 hover:bg-iron-100 dark:hover:bg-iron-700 transition-colors">
                      {pct}%
                    </button>
                  )
                })}
              </div>

              {Number(monto) > 0 && (
                <div className="mt-3 p-3 bg-accent-50 dark:bg-accent-900/20 rounded-xl border border-accent-200 dark:border-accent-700/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-iron-600 dark:text-iron-400">Multiplicador</span>
                    <span className="font-bold text-accent-600 dark:text-accent-300">x{multiplicador}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-iron-600 dark:text-iron-400">Ganancia potencial</span>
                    <span className="font-bold text-success">{formatPoints(ganancia)} pts</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {Number(monto) > (wallet?.balance || 0) && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <AlertCircle size={16} className="text-danger shrink-0" />
              <p className="text-xs text-danger">Saldo insuficiente. Realiza compras en Solutech para obtener mas puntos.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-iron-200 dark:border-iron-700 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={!canSubmit() || loading}
            className="btn-accent flex-1 flex items-center justify-center gap-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-iron-900/30 border-t-iron-900 rounded-full animate-spin" />
            ) : 'Confirmar Pronóstico'}
          </button>
        </div>
      </div>
    </div>
  )
}
