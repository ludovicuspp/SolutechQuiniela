import { useState, useEffect, useCallback } from 'react'
import { X, Clock, Trophy, ShoppingBag, TrendingUp, ArrowDownRight, ArrowUpRight, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatPoints, formatDateTime, getBetTypeLabel, getBetStatusColor } from '../../utils/formatters'

export default function UserHistoryModal({ user, onClose }) {
  const [tab, setTab] = useState('bets')
  const [bets, setBets] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState(new Set())

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      supabase.from('bets')
        .select('*, matches(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([betsRes, txRes]) => {
      if (!betsRes.error) setBets(betsRes.data)
      if (!txRes.error) setTransactions(txRes.data)
    }).finally(() => setLoading(false))
  }, [user.id])

  useEffect(() => {
    if (!user?.id) return
    fetchData()
  }, [user?.id, fetchData])

  const handleVoidBet = async (betId) => {
    if (!window.confirm('¿Anular esta apuesta? Se reembolsarán los puntos al usuario y podrá volver a pronosticar este partido.')) return
    setVoiding(prev => new Set(prev).add(betId))
    const { error } = await supabase.rpc('admin_void_bet', { p_bet_id: betId })
    setVoiding(prev => { const next = new Set(prev); next.delete(betId); return next })
    if (error) {
      toast.error(error.message || 'Error al anular la apuesta')
      return
    }
    toast.success('Apuesta anulada y puntos reembolsados')
    fetchData()
  }

  const getTxIcon = (tipo) => {
    if (tipo === 'compra') return <ShoppingBag size={16} className="text-success" />
    if (tipo === 'ganancia') return <TrendingUp size={16} className="text-success" />
    if (tipo === 'apuesta') return <ArrowDownRight size={16} className="text-danger" />
    return <ArrowUpRight size={16} className="text-primary-500" />
  }

  const getBetStatusLabel = (estado) => {
    const labels = { pendiente: 'Pendiente', ganada: 'Ganada', perdida: 'Perdida', reembolsada: 'Reembolsada' }
    return labels[estado] || estado
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-white dark:bg-iron-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-iron-200 dark:border-iron-700 shrink-0">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-success" />
            <div>
              <h3 className="text-lg font-bold text-iron-900 dark:text-white">
                {user.nombre || user.email || 'Usuario'}
              </h3>
              <p className="text-xs text-iron-500">
                Cédula: {user.rif || '—'} · Saldo: <span className="text-success font-bold">{formatPoints(user.wallets?.balance || 0)} pts</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-iron-400 hover:text-iron-600 dark:hover:text-iron-200 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-iron-200 dark:border-iron-700 shrink-0">
          <button onClick={() => setTab('bets')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${tab === 'bets' ? 'text-success border-b-2 border-success' : 'text-iron-500 hover:text-iron-700 dark:hover:text-iron-300'}`}>
            Apuestas ({bets.length})
          </button>
          <button onClick={() => setTab('transactions')}
            className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${tab === 'transactions' ? 'text-success border-b-2 border-success' : 'text-iron-500 hover:text-iron-700 dark:hover:text-iron-300'}`}>
            Movimientos ({transactions.length})
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="text-iron-400 animate-spin" />
            </div>
          ) : tab === 'bets' ? (
            bets.length === 0 ? (
              <p className="text-center text-iron-400 py-12 text-sm">Sin apuestas registradas</p>
            ) : (
              <div className="divide-y divide-iron-100 dark:divide-iron-700">
                {bets.map(bet => (
                  <div key={bet.id} className="p-4 space-y-2 hover:bg-iron-50 dark:hover:bg-iron-750 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-iron-900 dark:text-white truncate">
                          {bet.matches?.equipo_local || '—'} vs {bet.matches?.equipo_visitante || '—'}
                        </p>
                        <p className="text-xs text-iron-500">
                          {getBetTypeLabel(bet.tipo_apuesta)} · {formatDateTime(bet.created_at)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-iron-900 dark:text-white">{formatPoints(bet.monto)} pts</p>
                        <p className={`text-xs font-semibold ${getBetStatusColor(bet.estado)}`}>
                          {getBetStatusLabel(bet.estado)}
                        </p>
                      </div>
                    </div>
                    {bet.ganancia_potencial && (
                      <div className="flex items-center gap-1 text-xs text-iron-500">
                        <Trophy size={12} />
                        <span>Potencial: <strong className="text-success">{formatPoints(bet.ganancia_potencial)} pts</strong></span>
                        {bet.multiplicador && <span>· x{bet.multiplicador}</span>}
                      </div>
                    )}
                    {bet.estado === 'pendiente' && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleVoidBet(bet.id)}
                          disabled={voiding.has(bet.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 size={14} />
                          {voiding.has(bet.id) ? 'Anulando…' : 'Anular'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            transactions.length === 0 ? (
              <p className="text-center text-iron-400 py-12 text-sm">Sin movimientos registrados</p>
            ) : (
              <div className="divide-y divide-iron-100 dark:divide-iron-700">
                {transactions.map(tx => (
                  <div key={tx.id} className="p-4 flex items-center gap-3 hover:bg-iron-50 dark:hover:bg-iron-750 transition-colors">
                    <div className="w-8 h-8 bg-iron-100 dark:bg-iron-700 rounded-full flex items-center justify-center shrink-0">
                      {getTxIcon(tx.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-iron-900 dark:text-white">
                        {tx.descripcion || tx.tipo}
                      </p>
                      <p className="text-xs text-iron-500">{formatDateTime(tx.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${Number(tx.monto) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {Number(tx.monto) >= 0 ? '+' : ''}{formatPoints(tx.monto)} pts
                      </p>
                      {tx.balance_despues != null && (
                        <p className="text-xs text-iron-400">Saldo: {formatPoints(tx.balance_despues)} pts</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}