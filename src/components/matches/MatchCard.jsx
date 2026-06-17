import { useState } from 'react'
import { Clock, MapPin, Trophy, Equal, Target, ChevronDown, AlertCircle, CheckCircle2, Lock } from 'lucide-react'
import { formatDateTime, formatTime, formatPoints, getFaseLabel, isMatchBettable, isPronosticoHabilitado } from '../../utils/formatters'
import { Flag } from '../../utils/countries'
import { useAuthStore } from '../../store/authStore'
import { useBetStore, getMultiplier } from '../../store/betStore'
import toast from 'react-hot-toast'

/**
 * Tipos de jugada disponibles.
 * multKey → clave del MULTIPLIERS en betStore
 * dbTipo  → tipo_apuesta que entiende place_bet() en Supabase
 * tipoJugada → nueva columna bets.tipo_jugada
 */
const JUGADA_TABS = [
  {
    id:         'ganador',
    label:      'Ganador',
    icon:       Trophy,
    desc:       'Elige qué equipo gana',
    dbTipo:     'ganador',
    tipoJugada: 'ganador',
    multKey:    'ganador',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    activeRing: 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 shadow-blue-500/20',
    iconColor:  'text-blue-400',
  },
  {
    id:         'empate',
    label:      'Empate',
    icon:       Equal,
    desc:       'Pronostica un empate',
    dbTipo:     'empate',
    tipoJugada: 'empate',
    multKey:    'empate',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    activeRing: 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-amber-500/20',
    iconColor:  'text-amber-400',
  },
  {
    id:         'resultado',
    label:      'Exacto',
    icon:       Target,
    desc:       'Adivina el marcador',
    dbTipo:     'resultado_exacto',
    tipoJugada: 'resultado_exacto',
    multKey:    'resultado_exacto',
    badgeColor: 'bg-fifa-red/20 text-fifa-red border-fifa-red/30',
    activeRing: 'border-fifa-red bg-fifa-red/10 dark:bg-fifa-red/15 shadow-fifa-red/20',
    iconColor:  'text-fifa-red',
  },
]

export default function MatchCard({ match, compact = false, isReadOnly = false, hasBetted = false }) {
  const { user, wallet, refreshWallet } = useAuthStore()
  const { placeBet } = useBetStore()

  const [expanded,   setExpanded]   = useState(false)
  const [tab,        setTab]        = useState('ganador')
  const [prediccion, setPrediccion] = useState({})
  const [monto,      setMonto]      = useState('')
  const [loading,    setLoading]    = useState(false)

  const bettable           = isMatchBettable(match)
  const pronosticoAbierto  = isPronosticoHabilitado(match.fecha_partido)
  const balance            = wallet?.balance || 0
  const montoNum           = parseFloat(monto) || 0
  const excedeSaldo        = montoNum > balance

  const currentTab    = JUGADA_TABS.find(t => t.id === tab)
  const multiplicador = getMultiplier(match.fase, currentTab?.multKey || 'ganador')
  const ganancia      = montoNum * multiplicador

  // canBet: condiciones base para mostrar el panel de apuesta
  const canBet = !isReadOnly && !hasBetted && bettable && pronosticoAbierto

  /* ─── Validación de predicción según tab ─── */
  const prediccionValida = () => {
    if (tab === 'ganador')   return prediccion.resultado === 'local' || prediccion.resultado === 'visitante'
    if (tab === 'empate')    return true
    if (tab === 'resultado') return prediccion.goles_local !== undefined && prediccion.goles_visitante !== undefined
    return false
  }

  const canSubmit = canBet && montoNum > 0 && !excedeSaldo && prediccionValida()


  /* ─── Helpers ─── */
  const handleTabChange = (id) => { setTab(id); setPrediccion({}) }

  const handleMonto = (val) => {
    if (val === '') { setMonto(''); return }
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) { setMonto(''); return }
    setMonto(n > balance ? String(balance) : val)
  }

  /** Construye prediccion (campo JSON legacy) y las columnas nuevas */
  const buildPayload = () => {
    if (tab === 'empate') {
      return {
        prediccion:        { resultado: 'empate' },
        tipo_jugada:       'empate',
        marcador_local:    null,
        marcador_visitante: null,
      }
    }
    if (tab === 'ganador') {
      return {
        prediccion:        { resultado: prediccion.resultado },
        tipo_jugada:       'ganador',
        marcador_local:    null,
        marcador_visitante: null,
      }
    }
    // resultado exacto
    return {
      prediccion:        { goles_local: prediccion.goles_local, goles_visitante: prediccion.goles_visitante },
      tipo_jugada:       'resultado_exacto',
      marcador_local:    prediccion.goles_local ?? null,
      marcador_visitante: prediccion.goles_visitante ?? null,
    }
  }

  const handleBlockedClick = () => {
    toast.error('¡Ya tienes un pronóstico en este partido!')
  }

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (hasBetted || !canSubmit) return
    setLoading(true)

    try {
      const { prediccion: pred, tipo_jugada, marcador_local, marcador_visitante } = buildPayload()
      // placeBet llama a place_bet() RPC (SECURITY DEFINER). Los campos nuevos
      // tipo_jugada / marcador_local / marcador_visitante se pasan como extra en prediccion
      // para que el servidor los guarde, o podemos extender el RPC. Por ahora los
      // añadimos al objeto prediccion para que no se pierdan, y también los enviamos
      // como campos separados en un segundo UPDATE si el RPC no los soporta aún.
      await placeBet(
        user.id,
        match,
        currentTab.dbTipo,
        { ...pred, tipo_jugada, marcador_local, marcador_visitante },
        montoNum,
      )
      await refreshWallet().catch(() => {})
      toast.success('¡Pronóstico registrado!')
      setExpanded(false)
      setPrediccion({})
      setMonto('')
      setTab('ganador')
    } catch (err) {
      const msg = err?.message || ''
      if (msg.includes('saldo') || msg.includes('insufficient')) {
        toast.error('Saldo insuficiente para este pronóstico')
      } else if (msg.includes('ya') || msg.includes('already') || msg.includes('apuesta')) {
        toast.error('Ya tienes un pronóstico registrado en este partido')
      } else {
        toast.error('Error al registrar el pronóstico: ' + msg)
      }
    } finally {
      setLoading(false)
    }
  }

  /* ─── Badge estado del partido ─── */
  const statusBadge =
    match.estado === 'finalizado' ? 'bg-iron-200 dark:bg-iron-700 text-iron-600 dark:text-iron-300'  :
    match.estado === 'en_juego'   ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                    'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'

  /* ─── Estado del botón principal ─── */
  const btnPronosticar = () => {
    if (hasBetted) return null        // se maneja aparte
    if (!bettable)         return { label: 'Cerrado',   style: 'bg-iron-200 dark:bg-iron-700 text-iron-400 dark:text-iron-500 opacity-60 cursor-not-allowed' }
    if (!pronosticoAbierto) return { label: 'Bloqueado', style: 'bg-iron-200 dark:bg-iron-700 text-iron-400 dark:text-iron-500 opacity-60 cursor-not-allowed' }
    return null // canBet=true → botón normal
  }
  const btnEstado = btnPronosticar()

  return (
    <div className={`card transition-all duration-300 ${
      match.estado === 'en_juego' ? 'ring-2 ring-success animate-pulse-glow' : ''
    } ${expanded ? 'shadow-xl' : 'hover:shadow-md'}`}>

      {/* ── FASE / ESTADO ── */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge}`}>
          {getFaseLabel(match.fase)}{match.grupo ? ` · Grupo ${match.grupo}` : ''}
        </span>
        {match.estado === 'en_juego' && (
          <span className="flex items-center gap-1 text-xs text-success font-bold">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            EN VIVO
          </span>
        )}
      </div>

      {/* ── EQUIPOS ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <div className="flex justify-center mb-1">
            <Flag country={match.equipo_local} size={40} />
          </div>
          <p className="text-sm font-semibold text-iron-900 dark:text-white truncate">
            {match.equipo_local}
          </p>
        </div>

        <div className="text-center shrink-0 px-2">
          {match.estado === 'finalizado' || match.estado === 'en_juego' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-extrabold text-iron-900 dark:text-white tabular-nums">
                  {match.goles_local ?? 0}
                </span>
                <span className="text-iron-400 text-lg font-bold">-</span>
                <span className="text-3xl font-extrabold text-iron-900 dark:text-white tabular-nums">
                  {match.goles_visitante ?? 0}
                </span>
              </div>
              {match.penales_local != null && match.penales_visitante != null && match.estado === 'finalizado' && (
                <div className="mt-0.5 text-xs text-iron-500">
                  Penales{' '}
                  <span className={match.penales_local > match.penales_visitante ? 'font-bold text-fifa-green' : ''}>
                    {match.penales_local}
                  </span>
                  {'-'}
                  <span className={match.penales_visitante > match.penales_local ? 'font-bold text-fifa-green' : ''}>
                    {match.penales_visitante}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-xl font-bold text-iron-400">VS</p>
          )}
        </div>

        <div className="flex-1 text-center">
          <div className="flex justify-center mb-1">
            <Flag country={match.equipo_visitante} size={40} />
          </div>
          <p className="text-sm font-semibold text-iron-900 dark:text-white truncate">
            {match.equipo_visitante}
          </p>
        </div>
      </div>

      {/* ── FOOTER: fecha + (botón solo si no es readonly) ── */}
      {!compact && (
        <div className={`mt-3 pt-3 border-t border-iron-200 dark:border-iron-700 flex items-center ${isReadOnly ? 'justify-center' : 'justify-between'} gap-2`}>
          <div className={`flex flex-col gap-0.5 text-xs text-iron-500 dark:text-iron-400 min-w-0 ${isReadOnly ? 'items-center text-center' : ''}`}>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {match.estado === 'programado'
                ? formatDateTime(match.fecha_partido)
                : formatTime(match.fecha_partido)}
            </span>
            {match.sede && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                <span className="truncate">{match.sede}</span>
              </span>
            )}
          </div>

          {!isReadOnly && (
            hasBetted ? (
              <button
                onClick={handleBlockedClick}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl shrink-0 bg-iron-300 dark:bg-iron-600 text-iron-500 dark:text-iron-300 cursor-not-allowed opacity-70"
              >
                <Lock size={13} />
                Jugado
              </button>
            ) : btnEstado ? (
              <button
                disabled
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl shrink-0 ${btnEstado.style}`}
              >
                <Lock size={13} />
                {btnEstado.label}
              </button>
            ) : (
              <button
                onClick={() => setExpanded(e => !e)}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all shrink-0 ${
                  expanded
                    ? 'bg-iron-100 dark:bg-iron-700 text-iron-600 dark:text-iron-300'
                    : 'bg-gradient-to-r from-fifa-red to-fifa-orange text-white shadow-lg shadow-fifa-red/30 hover:opacity-90'
                }`}
              >
                <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Cerrar' : 'Pronosticar'}
              </button>
            )
          )}
        </div>
      )}

      {/* ══ PANEL: ya jugó ══ */}
      {!isReadOnly && hasBetted && (
        <div className="mt-4 pt-4 border-t border-iron-200 dark:border-iron-700">
          <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-2xl bg-gradient-to-br from-success/5 to-success/10 dark:from-success/10 dark:to-success/5 border-2 border-success/30 dark:border-success/20">
            <CheckCircle2 size={24} className="text-success" />
            <div className="text-center">
              <p className="text-sm font-bold text-success">¡Ya realizaste tu pronóstico!</p>
              <p className="text-xs text-iron-500 dark:text-iron-400 mt-1">Solo se permite una jugada por partido</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ PANEL: ventana de pronóstico cerrada ══ */}
      {!isReadOnly && !hasBetted && !pronosticoAbierto && bettable && (
        <div className="mt-4 pt-4 border-t border-iron-200 dark:border-iron-700">
          <div className="flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-iron-100 dark:bg-iron-800/60 border border-iron-200 dark:border-iron-700">
            <Lock size={20} className="text-iron-400" />
            <p className="text-xs font-semibold text-iron-500 dark:text-iron-400 text-center">
              Pronósticos cerrados · La ventana se cierra 10 minutos antes del inicio del partido
            </p>
          </div>
        </div>
      )}

      {/* ══ PANEL DE PRONÓSTICO ══ */}
      {expanded && canBet && (
        <div className="mt-4 pt-4 border-t border-iron-200 dark:border-iron-700 space-y-4 animate-fade-in">

          {/* ── SELECTOR DE TIPO DE JUGADA ── */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-iron-500 dark:text-iron-400 uppercase tracking-widest">
              Tipo de jugada
            </p>
            <div className="grid grid-cols-3 gap-2">
              {JUGADA_TABS.map(t => {
                const mult   = getMultiplier(match.fase, t.multKey)
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTabChange(t.id)}
                    className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all shadow-sm ${
                      active
                        ? `${t.activeRing} shadow-md`
                        : 'border-iron-200 dark:border-iron-700 hover:border-iron-300 dark:hover:border-iron-600 bg-white dark:bg-iron-800/40'
                    }`}
                  >
                    {/* Badge multiplicador */}
                    <span className={`absolute -top-2 -right-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border ${t.badgeColor}`}>
                      x{mult}
                    </span>
                    <t.icon size={18} className={active ? t.iconColor : 'text-iron-400'} />
                    <span className={`text-xs font-bold leading-tight text-center ${
                      active ? 'text-iron-900 dark:text-white' : 'text-iron-500 dark:text-iron-400'
                    }`}>
                      {t.label}
                    </span>
                    <span className={`text-[10px] leading-snug text-center px-0.5 ${
                      active ? 'text-iron-600 dark:text-iron-300' : 'text-iron-400'
                    }`}>
                      {t.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── TAB: GANADOR — local o visitante ── */}
          {tab === 'ganador' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-iron-500 dark:text-iron-400">¿Quién gana?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'local',     team: match.equipo_local     },
                  { val: 'visitante', team: match.equipo_visitante },
                ].map(opt => {
                  const active = prediccion.resultado === opt.val
                  return (
                    <button
                      key={opt.val}
                      onClick={() => setPrediccion({ resultado: opt.val })}
                      className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 shadow-sm shadow-blue-500/20'
                          : 'border-iron-200 dark:border-iron-700 hover:border-iron-300 dark:hover:border-iron-600'
                      }`}
                    >
                      <Flag country={opt.team} size={38} />
                      <span className={`text-xs font-bold text-center leading-tight line-clamp-2 ${
                        active ? 'text-blue-500 dark:text-blue-400' : 'text-iron-800 dark:text-iron-200'
                      }`}>
                        {opt.team}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── TAB: EMPATE ── */}
          {tab === 'empate' && (
            <div className="flex items-center justify-center gap-4 py-5 px-3 rounded-2xl bg-amber-500/5 border-2 border-amber-500/30 dark:border-amber-500/20">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <Flag country={match.equipo_local} size={34} />
                <span className="text-xs text-iron-500 truncate max-w-[72px] text-center mt-0.5">
                  {match.equipo_local}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <Equal size={32} className="text-amber-400" />
                <span className="text-xs font-extrabold text-amber-400 tracking-wide">EMPATE</span>
              </div>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <Flag country={match.equipo_visitante} size={34} />
                <span className="text-xs text-iron-500 truncate max-w-[72px] text-center mt-0.5">
                  {match.equipo_visitante}
                </span>
              </div>
            </div>
          )}

          {/* ── TAB: RESULTADO EXACTO ── */}
          {tab === 'resultado' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-iron-500 dark:text-iron-400">Marcador exacto</p>
              <div className="flex items-end justify-center gap-4 py-3 px-3 rounded-2xl bg-fifa-red/5 border-2 border-fifa-red/20 dark:border-fifa-red/15">
                <div className="flex flex-col items-center gap-2">
                  <Flag country={match.equipo_local} size={30} />
                  <p className="text-xs text-iron-500 max-w-[72px] text-center truncate">
                    {match.equipo_local}
                  </p>
                  <input
                    type="number" min="0" max="20"
                    value={prediccion.goles_local ?? ''}
                    onChange={e => setPrediccion(p => ({ ...p, goles_local: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 text-center text-3xl font-extrabold input-field !p-0 border-2 border-fifa-red/40 focus:border-fifa-red"
                  />
                </div>
                <span className="text-3xl font-bold text-iron-400 pb-4">–</span>
                <div className="flex flex-col items-center gap-2">
                  <Flag country={match.equipo_visitante} size={30} />
                  <p className="text-xs text-iron-500 max-w-[72px] text-center truncate">
                    {match.equipo_visitante}
                  </p>
                  <input
                    type="number" min="0" max="20"
                    value={prediccion.goles_visitante ?? ''}
                    onChange={e => setPrediccion(p => ({ ...p, goles_visitante: parseInt(e.target.value) || 0 }))}
                    className="w-16 h-16 text-center text-3xl font-extrabold input-field !p-0 border-2 border-fifa-red/40 focus:border-fifa-red"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── MONTO ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-iron-600 dark:text-iron-400 uppercase tracking-wide">
                Puntos a jugar
              </label>
              <span className="text-xs text-iron-500">
                Saldo: <span className="font-bold text-success">{formatPoints(balance)} pts</span>
              </span>
            </div>

            <input
              type="number" min="1" max={balance} step="0.01"
              value={monto}
              onChange={e => handleMonto(e.target.value)}
              placeholder="Ingresa los puntos"
              className={`input-field text-base font-semibold ${excedeSaldo ? 'border-danger' : ''}`}
            />

            {/* Accesos rápidos */}
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map(pct => {
                const val = ((balance * pct) / 100).toFixed(2)
                return (
                  <button
                    key={pct}
                    onClick={() => setMonto(val)}
                    className="py-1.5 text-xs font-semibold rounded-lg border border-iron-300 dark:border-iron-600 hover:bg-iron-100 dark:hover:bg-iron-700 text-iron-600 dark:text-iron-300 transition-colors"
                  >
                    {pct}%
                  </button>
                )
              })}
            </div>

            {montoNum > 0 && !excedeSaldo && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-success/5 to-success/10 dark:from-success/10 dark:to-success/5 rounded-xl border border-success/20">
                <span className="text-xs text-iron-600 dark:text-iron-400">
                  Multiplicador <span className={`font-extrabold text-sm ${currentTab?.iconColor || 'text-accent-500'}`}>x{multiplicador}</span>
                </span>
                <span className="text-sm font-extrabold text-success">+{formatPoints(ganancia)} pts</span>
              </div>
            )}

            {excedeSaldo && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/40">
                <AlertCircle size={14} className="text-danger shrink-0" />
                <p className="text-xs text-danger font-medium">
                  Saldo insuficiente. Disponible: {formatPoints(balance)} pts
                </p>
              </div>
            )}
          </div>

          {/* ── BOTÓN CONFIRMAR ── */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full py-3.5 rounded-2xl font-extrabold text-base tracking-widest uppercase
                       bg-gradient-to-r from-fifa-red via-fifa-orange to-accent-400
                       text-white shadow-lg shadow-fifa-red/40
                       hover:opacity-95 hover:shadow-xl hover:shadow-fifa-red/50
                       active:scale-[0.98] transition-all
                       disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : 'Confirmar Pronóstico'}
          </button>

        </div>
      )}
    </div>
  )
}
