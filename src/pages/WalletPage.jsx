import { useEffect, useState } from 'react'
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, ShoppingBag } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { formatPoints, formatDateTime } from '../utils/formatters'

export default function WalletPage() {
  const { profile, wallet, refreshWallet } = useAuthStore()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchTransactions = async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error && data) setTransactions(data)
    } catch {
      // Fallo de red: mantener transacciones anteriores
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.id) {
      refreshWallet()
      fetchTransactions()
    }
  }, [])

  const getTxIcon = (tipo) => {
    if (tipo === 'compra') return <ShoppingBag size={16} className="text-success" />
    if (tipo === 'ganancia') return <TrendingUp size={16} className="text-success" />
    if (tipo === 'apuesta') return <ArrowDownRight size={16} className="text-danger" />  // jugada
    return <ArrowUpRight size={16} className="text-primary-500" />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
          <Wallet size={24} className="text-primary-500" />
          Mis Puntos
        </h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
          <p className="text-sm font-medium opacity-80">Balance Actual</p>
          <p className="text-3xl font-bold mt-2">{formatPoints(wallet?.balance || 0)}</p>
          <p className="text-sm opacity-70 mt-1">puntos Solutech</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-success">
            <ArrowUpRight size={20} />
            <span className="text-sm font-medium">Total Ganado</span>
          </div>
          <p className="text-2xl font-bold text-iron-900 dark:text-white mt-2">
            {formatPoints(wallet?.total_earned || 0)}
          </p>
          <p className="text-xs text-iron-500 mt-1">por compras + ganancias</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-accent-400">
            <TrendingUp size={20} />
            <span className="text-sm font-medium">Total Jugado</span>
          </div>
          <p className="text-2xl font-bold text-iron-900 dark:text-white mt-2">
            {formatPoints(wallet?.total_wagered || 0)}
          </p>
          <p className="text-xs text-iron-500 mt-1">en jugadas</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-4">
          Historial de Movimientos
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-iron-500 py-8">Sin movimientos aun</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-iron-50 dark:hover:bg-iron-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  {getTxIcon(tx.tipo)}
                  <div>
                    <p className="text-sm font-medium text-iron-900 dark:text-white">
                      {tx.descripcion || tx.tipo}
                    </p>
                    <p className="text-xs text-iron-500">{formatDateTime(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${Number(tx.monto) >= 0 ? 'text-success' : 'text-danger'}`}>
                    {Number(tx.monto) >= 0 ? '+' : ''}{formatPoints(tx.monto)}
                  </p>
                  <p className="text-xs text-iron-400">
                    Saldo: {formatPoints(tx.balance_despues)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
