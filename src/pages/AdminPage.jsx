import { useState, useEffect } from 'react'
import { Shield, Trophy, Users, Bell, RefreshCw, Plus, Edit3, Trash2, X, Coins, Clock } from 'lucide-react'
import { useAdminStore, useResolveBets } from '../store/useAdminStore'
import { supabase } from '../lib/supabase'
import { formatPoints } from '../utils/formatters'
import UserHistoryModal from '../components/admin/UserHistoryModal'
import toast from 'react-hot-toast'

const CORTES = ['Corte 1', 'Corte 2', 'Corte 3', 'Corte 4']

export default function AdminPage() {
  const {
    isLoading: syncing,
    isSendingNotification,
    syncMatchesWithAPI,
    loadUsers,
    sendGlobalNotification,
    prizes,
    isLoadingPrizes,
    isSubmittingPrize,
    fetchPrizes,
    createPrize,
    updatePrize,
    deletePrize,
  } = useAdminStore()

  const [activeTab, setActiveTab] = useState('premios')
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [errorUsers, setErrorUsers] = useState(null)

  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifType, setNotifType] = useState('info')

  const [showPrizeModal, setShowPrizeModal] = useState(false)
  const [editingPrize, setEditingPrize] = useState(null)
  const [prizeForm, setPrizeForm] = useState({
    fase: 'Corte 1',
    titulo: '',
    descripcion: '',
    posicion: 1
  })

  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({
    email: '', password: '', nombre: '', rif: '', telefono: '', zona: '', vendedor: '', empresa: '', puntosIniciales: 1000, is_admin: false
  })
  const [savingUser, setSavingUser] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedUserHistory, setSelectedUserHistory] = useState(null)

  const [rechargeForm, setRechargeForm] = useState({
    userId: '',
    puntos: '',
    nota: ''
  })
  const [submittingRecharge, setSubmittingRecharge] = useState(false)

  const {
    finishedMatches,
    isLoadingFinished,
    fetchFinishedMatches,
    resolveMatchBets,
    isResolvingBets,
  } = useResolveBets()
  const [penaltiesForm, setPenaltiesForm] = useState({})

  const handleSyncMatches = async () => {
    const result = await syncMatchesWithAPI()
    if (result.success) {
      toast.success(`${result.count} partidos sincronizados${result.mock ? ' (mock)' : ''}`)
    } else {
      toast.error(result.error || 'Error sincronizando partidos')
    }
  }

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error('Completa el título y el mensaje')
      return
    }
    const result = await sendGlobalNotification(notifTitle, notifMessage, notifType)
    if (result.success) {
      toast.success(`Notificación enviada a ${result.count} usuarios`)
      setNotifTitle('')
      setNotifMessage('')
      setNotifType('info')
    } else {
      toast.error(result.error || 'Error enviando notificación')
    }
  }

  const openPrizeModal = (prize = null) => {
    if (prize) {
      setEditingPrize(prize)
      setPrizeForm({
        fase: prize.fase,
        titulo: prize.titulo,
        descripcion: prize.descripcion || '',
        posicion: prize.posicion || 1
      })
    } else {
      setEditingPrize(null)
      setPrizeForm({ fase: 'Corte 1', titulo: '', descripcion: '', posicion: 1 })
    }
    setShowPrizeModal(true)
  }

  const closePrizeModal = () => {
    setShowPrizeModal(false)
    setEditingPrize(null)
    setPrizeForm({ fase: 'Corte 1', titulo: '', descripcion: '', posicion: 1 })
  }

  const handleSavePrize = async () => {
    if (!prizeForm.titulo.trim()) { toast.error('El título del premio es requerido'); return }
    if (!prizeForm.fase) { toast.error('Selecciona una fase'); return }
    if (!prizeForm.posicion || prizeForm.posicion < 1) { toast.error('La posición debe ser mayor a 0'); return }
    const result = editingPrize
      ? await updatePrize(editingPrize.id, prizeForm)
      : await createPrize(prizeForm)
    if (result.success) {
      toast.success(editingPrize ? 'Premio actualizado' : 'Premio creado')
      closePrizeModal()
    } else {
      toast.error(result.error || 'Error guardando premio')
    }
  }

  const handleDeletePrize = (prizeId) => {
    if (window.confirm('¿Seguro que deseas eliminar este premio?')) {
      deletePrize(prizeId).then(result => {
        if (result.success) toast.success('Premio eliminado')
        else toast.error(result.error || 'Error al eliminar premio')
      })
    }
  }

  const sortedPrizes = [...prizes].sort((a, b) => {
    const faseOrder = CORTES.indexOf(a.fase) - CORTES.indexOf(b.fase)
    if (faseOrder !== 0) return faseOrder
    return (a.posicion || 0) - (b.posicion || 0)
  })

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        email: '',
        password: '',
        nombre: user.nombre || '',
        rif: user.rif || '',
        telefono: user.telefono || '',
        zona: user.zona || '',
        vendedor: user.vendedor || '',
        empresa: user.empresa || '',
    puntosIniciales: 0,
    is_admin: !!user.is_admin,
  })
} else {
  setEditingUser(null)
  setUserForm({ email: '', password: '', nombre: '', rif: '', telefono: '', zona: '', vendedor: '', empresa: '', puntosIniciales: 1000, is_admin: false })
}
setShowUserModal(true)
}

const closeUserModal = () => {
setShowUserModal(false)
setEditingUser(null)
setUserForm({ email: '', password: '', nombre: '', rif: '', telefono: '', zona: '', vendedor: '', empresa: '', puntosIniciales: 1000, is_admin: false })
}

  const handleSaveUser = async () => {
    if (!userForm.nombre || !userForm.rif) { toast.error('Nombre y Cédula son requeridos'); return }
    if (!editingUser && (!userForm.email || !userForm.password || userForm.password.length < 6)) {
      toast.error('Email y contraseña (mínimo 6 caracteres) son requeridos'); return
    }
    setSavingUser(true)
    let result
    if (editingUser) {
      result = await useAdminStore.getState().updateUser(editingUser.id, {
        nombre: userForm.nombre,
        rif: userForm.rif,
        telefono: userForm.telefono,
        zona: userForm.zona,
        vendedor: userForm.vendedor,
        empresa: userForm.empresa,
        is_admin: userForm.is_admin === true || userForm.is_admin === 'true'
      })
    } else {
      result = await useAdminStore.getState().createUser(userForm)
    }
    setSavingUser(false)
    if (result.success) {
      toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado')
      closeUserModal()
      const loadRes = await loadUsers()
      if (loadRes.success) setUsers(loadRes.users)
    } else {
      toast.error(result.error || 'Error guardando usuario')
    }
  }

  const handleDeleteUser = async (userId) => {
    setDeleteConfirm(userId)
  }

  const confirmDeleteUser = async () => {
    if (!deleteConfirm) return
    const result = await useAdminStore.getState().deleteUser(deleteConfirm)
    setDeleteConfirm(null)
    if (result.success) {
      toast.success('Usuario eliminado')
      const loadRes = await loadUsers()
      if (loadRes.success) setUsers(loadRes.users)
    } else {
      toast.error(result.error || 'Error eliminando usuario')
    }
  }

  useEffect(() => {
    fetchPrizes()
    loadUsers().then(res => {
      if (res.success) setUsers(res.users)
      else setErrorUsers(res.error)
      setLoadingUsers(false)
    })
    if (activeTab === 'sincronizar') {
      fetchFinishedMatches()
    }
  }, [activeTab])

  const handleSubmitRecharge = async () => {
    if (!rechargeForm.userId || !rechargeForm.puntos || Number(rechargeForm.puntos) <= 0) {
      toast.error('Selecciona un usuario e ingresa una cantidad de puntos válida')
      return
    }
    setSubmittingRecharge(true)
    try {
      const { error } = await supabase.rpc('admin_recharge_points', {
        p_user_id: rechargeForm.userId,
        p_puntos: Number(rechargeForm.puntos),
        p_descripcion: rechargeForm.nota.trim() || 'Recarga de puntos',
      })
      if (error) throw error
      toast.success(`${Number(rechargeForm.puntos).toLocaleString()} puntos recargados`)
      setRechargeForm({ userId: '', puntos: '', nota: '' })
    } catch (err) {
      toast.error(err.message || 'Error recargando puntos')
    } finally {
      setSubmittingRecharge(false)
    }
  }

  const tabs = [
    { id: 'premios', label: 'Premios', icon: Trophy },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'recarga', label: 'Recarga de puntos', icon: Coins },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
    { id: 'sincronizar', label: 'Sincronizar', icon: RefreshCw },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-fifa-purple to-fifa-purple-dark rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-iron-900 dark:text-white">Panel de Administración</h1>
          <p className="text-sm text-iron-500">Gestión de premios, usuarios, recarga de puntos y más</p>
        </div>
      </div>

      <>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-fifa-purple text-white shadow-lg shadow-fifa-purple/30'
                      : 'bg-iron-100 dark:bg-iron-800 text-iron-600 dark:text-iron-400 hover:bg-iron-200 dark:hover:bg-iron-700'
                  }`}
                >
                  <Icon size={14} className="sm:size-[16px]" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === 'premios' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-iron-900 dark:text-white flex items-center gap-2">
                  <Trophy size={20} className="text-yellow-500" />
                  Gestión de Premios
                </h2>
                <button onClick={() => openPrizeModal()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg transition-colors">
                  <Plus size={14} /> Nuevo Premio
                </button>
              </div>

              {isLoadingPrizes ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                </div>
              ) : sortedPrizes.length === 0 ? (
                <div className="text-center py-8 text-iron-500">
                  <Trophy size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay premios registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                    {sortedPrizes.map(prize => (
                      <div key={prize.id}
                        className="flex items-center justify-between p-3 bg-iron-50 dark:bg-iron-800/50 rounded-xl border border-iron-200 dark:border-iron-700 hover:shadow-md transition-shadow">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">{prize.fase}</span>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-500/20 text-primary-700 dark:text-primary-300">#{prize.posicion}</span>
                            <p className="font-medium text-iron-900 dark:text-white truncate">{prize.titulo}</p>
                          </div>
                          {prize.descripcion && <p className="text-xs text-iron-500 mt-1 truncate">{prize.descripcion}</p>}
                        </div>
                        <div className="flex items-center gap-1 ml-2 sm:ml-3 flex-shrink-0">
                          <button onClick={() => openPrizeModal(prize)}
                            className="p-2 sm:p-1.5 text-iron-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors active:scale-95" title="Editar">
                            <Edit3 size={16} className="sm:size-[14px]" />
                          </button>
                          <button onClick={() => handleDeletePrize(prize.id)}
                            className="p-2 sm:p-1.5 text-iron-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors active:scale-95" title="Eliminar">
                            <Trash2 size={16} className="sm:size-[14px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-iron-900 dark:text-white flex items-center gap-2">
                  <Users size={20} className="text-fifa-purple" />
                  Gestión de Usuarios
                </h2>
                <button onClick={() => openUserModal()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-fifa-purple hover:bg-fifa-purple-dark text-white font-semibold rounded-lg transition-colors">
                  <Plus size={14} /> Nuevo Usuario
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-iron-200 dark:border-iron-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-iron-500 border-b border-iron-200 dark:border-iron-700 bg-iron-50 dark:bg-iron-800">
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium max-sm:hidden">Admin</th>
                      <th className="px-3 py-2 font-medium text-right max-sm:hidden">Balance</th>
                      <th className="px-3 py-2 font-medium text-right max-sm:hidden">Jugado</th>
                      <th className="px-3 py-2 font-medium text-right">Ganado</th>
                      <th className="px-3 py-2 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center">
                        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
                      </td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-iron-500 text-sm">
                        {errorUsers ? `Error: ${errorUsers}` : 'No hay usuarios registrados'}
                      </td></tr>
                    ) : users.map((u) => (
                      <tr key={u.id} className="border-b border-iron-100 dark:border-iron-700/50 last:border-0">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {u.nombre?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-iron-900 dark:text-white truncate">{u.nombre}</p>
                              <p className="text-xs text-iron-500 truncate">{u.rif}{u.alias ? ` · ${u.alias}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 max-sm:hidden">
                          {u.is_admin ? (
                            <span className="px-2 py-0.5 bg-fifa-purple/20 text-fifa-purple text-xs rounded-full">Sí</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-iron-100 text-iron-500 text-xs rounded-full">No</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-fifa-green max-sm:hidden">{formatPoints(u.wallets?.balance || 0)} pts</td>
                        <td className="px-3 py-3 text-right text-iron-600 dark:text-iron-400 max-sm:hidden">{formatPoints(u.wallets?.total_wagered || 0)} pts</td>
                        <td className="px-3 py-3 text-right text-fifa-purple">{formatPoints(u.wallets?.total_won || 0)} pts</td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setSelectedUserHistory(u)}
                              className="p-1.5 text-xs font-bold text-fifa-green bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-800/40 rounded-lg transition-colors active:scale-95" title="Ver historial de apuestas y recargas">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>Historial</span>
                              </span>
                            </button>
                            <button onClick={() => openUserModal(u)}
                              className="p-2 sm:p-1.5 text-iron-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors active:scale-95" title="Editar">
                              <Edit3 size={16} className="sm:size-[14px]" />
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)}
                              className="p-2 sm:p-1.5 text-iron-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors active:scale-95" title="Eliminar">
                              <Trash2 size={16} className="sm:size-[14px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'recarga' && (
            <div className="card">
              <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-4 flex items-center gap-2">
                <Coins size={20} className="text-fifa-green" />
                Recargar Puntos
              </h2>
              <p className="text-xs text-iron-500 mb-5">Selecciona un empleado y la cantidad de puntos a recargar. La transacción quedará registrada en su historial.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Usuario *</label>
                  <select value={rechargeForm.userId} onChange={e => setRechargeForm(f => ({ ...f, userId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-green/40">
                    <option value="">Seleccionar usuario...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.rif})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Puntos *</label>
                  <input type="number" step="1" min="1" value={rechargeForm.puntos} onChange={e => setRechargeForm(f => ({ ...f, puntos: e.target.value }))}
                    placeholder="Ej: 500"
                    className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-green/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Nota (opcional)</label>
                  <input type="text" value={rechargeForm.nota} onChange={e => setRechargeForm(f => ({ ...f, nota: e.target.value }))}
                    placeholder="Ej: Bono trimestral"
                    className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-green/40" />
                </div>
              </div>
              <button onClick={handleSubmitRecharge} disabled={submittingRecharge}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fifa-green to-emerald-500 hover:opacity-90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-fifa-green/30">
                {submittingRecharge ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Recargando...</>
                ) : (
                  <><Coins size={18} /> Recargar Puntos</>
                )}
              </button>
            </div>
          )}

          {activeTab === 'notificaciones' && (
            <div className="card">
              <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-1 flex items-center gap-2">
                <Bell size={20} className="text-fifa-red" />
                Centro de Notificaciones
              </h2>
              <p className="text-xs text-iron-500 mb-5">Envía un mensaje global a todos los usuarios registrados</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Título</label>
                  <input type="text" placeholder="Ej: Nueva promoción disponible" value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
                    className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white placeholder-iron-400 dark:placeholder-iron-500 text-sm focus:outline-none focus:ring-2 focus:ring-fifa-red/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Mensaje</label>
                  <textarea placeholder="Escribe el contenido de la notificación aquí..." value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white placeholder-iron-400 dark:placeholder-iron-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-fifa-red/40" />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
                  <div className="sm:w-auto">
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Tipo</label>
                    <select value={notifType} onChange={e => setNotifType(e.target.value)}
                      className="w-full sm:w-auto px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-red/40">
                      <option value="info">Información</option>
                      <option value="warning">Alerta</option>
                      <option value="success">Promoción</option>
                      <option value="error">Urgente</option>
                    </select>
                  </div>
                  <button onClick={handleSendNotification} disabled={isSendingNotification}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fifa-red to-fifa-orange hover:opacity-90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-fifa-red/30 text-sm">
                    {isSendingNotification ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                    ) : (
                      <><Bell size={15} /> Enviar</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sincronizar' && (
            <div className="card">
              <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-4 flex items-center gap-2">
                <RefreshCw size={20} className="text-fifa-purple" />
                Sincronización de Partidos
              </h2>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-iron-900 dark:text-white">Sincronizar Todos los Partidos</p>
                    <p className="text-xs text-iron-500 mt-0.5">Actualiza todos los partidos desde API-Football (vía Edge Function server-side)</p>
                  </div>
                  <button onClick={handleSyncMatches} disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fifa-purple to-fifa-purple-dark hover:opacity-90 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-fifa-purple/30">
                    {syncing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sincronizando...</>
                    ) : (
                      <><RefreshCw size={16} /> Sincronizar Partidos</>
                    )}
                  </button>
                </div>

                <div className="border-t border-iron-200 dark:border-iron-700 pt-4">
                  <h3 className="text-sm font-bold text-iron-900 dark:text-white mb-3">Resolver Pronósticos</h3>
                  {isLoadingFinished ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                  ) : finishedMatches.length === 0 ? (
                    <p className="text-xs text-iron-500 py-4 text-center">No hay partidos finalizados. Sincroniza primero.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {finishedMatches.map(match => (
                        <div key={match.id}
                          className="flex items-center gap-2 p-2 bg-iron-50 dark:bg-iron-800/50 rounded-lg border border-iron-200 dark:border-iron-700">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-iron-900 dark:text-white truncate">
                              {match.equipo_local} vs {match.equipo_visitante}
                            </p>
                            <p className="text-xs text-iron-500">{match.fase} · {match.goles_local}–{match.goles_visitante}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" placeholder="LOC" value={penaltiesForm[match.id]?.penLocal ?? ''}
                              onChange={e => setPenaltiesForm(f => ({ ...f, [match.id]: { ...f[match.id], penLocal: e.target.value } }))}
                              className="w-11 px-1 py-1 text-xs bg-white dark:bg-iron-700 border border-iron-300 dark:border-iron-600 rounded text-center text-iron-900 dark:text-white" />
                            <span className="text-xs text-iron-400">–</span>
                            <input type="number" min="0" placeholder="VIS" value={penaltiesForm[match.id]?.penVisit ?? ''}
                              onChange={e => setPenaltiesForm(f => ({ ...f, [match.id]: { ...f[match.id], penVisit: e.target.value } }))}
                              className="w-11 px-1 py-1 text-xs bg-white dark:bg-iron-700 border border-iron-300 dark:border-iron-600 rounded text-center text-iron-900 dark:text-white" />
                            <button
                              onClick={async () => {
                                const penLocal = Number(penaltiesForm[match.id]?.penLocal)
                                const penVisit = Number(penaltiesForm[match.id]?.penVisit)
                                const result = await resolveMatchBets(match.id, penLocal || null, penVisit || null)
                                if (result.success) {
                                  const r = result.data
                                  toast.success(`Resuelto: ${r.ganadas} ganadas, ${r.perdidas} perdidas${r.revertidas > 0 ? `, ${r.revertidas} revertidas` : ''}`)
                                } else {
                                  toast.error(result.error || 'Error resolviendo')
                                }
                              }}
                              className="px-2 py-1 text-xs bg-gradient-to-r from-fifa-purple to-fifa-purple-dark hover:opacity-90 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                              disabled={isResolvingBets}>
                              {isResolvingBets ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Resolver'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Prize Modal */}
          {showPrizeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
              <div className="bg-white dark:bg-iron-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-iron-200 dark:border-iron-700">
                  <h3 className="text-lg font-bold text-iron-900 dark:text-white">{editingPrize ? 'Editar Premio' : 'Nuevo Premio'}</h3>
                  <button onClick={closePrizeModal} className="p-1 text-iron-400 hover:text-iron-600 dark:hover:text-iron-200"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-2">Corte *</label>
                    <select value={prizeForm.fase} onChange={e => setPrizeForm(f => ({ ...f, fase: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40">
                      {CORTES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-2">Título del Premio *</label>
                    <input type="text" value={prizeForm.titulo} onChange={e => setPrizeForm(f => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej. Televisor Smart TV 55'"
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-2">Posición *</label>
                    <input type="number" min="1" value={prizeForm.posicion} onChange={e => setPrizeForm(f => ({ ...f, posicion: parseInt(e.target.value) || 1 }))}
                      placeholder="1"
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-2">Descripción (opcional)</label>
                    <textarea value={prizeForm.descripcion} onChange={e => setPrizeForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Ej. Para el primer lugar del ranking de esta fase" rows="3"
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40 resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 p-4 border-t border-iron-200 dark:border-iron-700">
                  <button onClick={closePrizeModal}
                    className="flex-1 px-4 py-2.5 bg-iron-100 dark:bg-iron-700 text-iron-700 dark:text-iron-200 font-semibold rounded-xl hover:bg-iron-200 dark:hover:bg-iron-600 transition-colors">Cancelar</button>
                  <button onClick={handleSavePrize} disabled={isSubmittingPrize}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50">
                    {isSubmittingPrize ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</> : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Modal */}
          {showUserModal && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
              <div className="bg-white dark:bg-iron-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-iron-200 dark:border-iron-700">
                  <h3 className="text-lg font-bold text-iron-900 dark:text-white">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                  <button onClick={closeUserModal} className="p-1 text-iron-400 hover:text-iron-600 dark:hover:text-iron-200"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Email {!editingUser ? '*' : '(Manejado por auth)'}</label>
                    <input type="email" value={userForm.email} onChange={e => !editingUser && setUserForm(f => ({ ...f, email: e.target.value }))} disabled={!!editingUser}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors ${
                        editingUser
                          ? 'bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                          : 'bg-iron-50 dark:bg-iron-700/50 border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white focus:ring-2 focus:ring-fifa-purple/40'
                      }`} />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Contraseña *</label>
                      <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                        className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Nombre Completo *</label>
                    <input type="text" value={userForm.nombre} onChange={e => setUserForm(f => ({ ...f, nombre: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Cédula *</label>
                    <input type="text" value={userForm.rif} onChange={e => setUserForm(f => ({ ...f, rif: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Teléfono</label>
                    <input type="text" value={userForm.telefono} onChange={e => setUserForm(f => ({ ...f, telefono: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Zona</label>
                    <input type="text" value={userForm.zona} onChange={e => setUserForm(f => ({ ...f, zona: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Vendedor</label>
                    <input type="text" value={userForm.vendedor} onChange={e => setUserForm(f => ({ ...f, vendedor: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Empresa</label>
                    <input type="text" value={userForm.empresa} onChange={e => setUserForm(f => ({ ...f, empresa: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Puntos Iniciales</label>
                      <input type="number" min="0" value={userForm.puntosIniciales} onChange={e => setUserForm(f => ({ ...f, puntosIniciales: Number(e.target.value) }))}
                        className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-fifa-purple/40" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_admin" checked={userForm.is_admin} onChange={e => setUserForm(f => ({ ...f, is_admin: e.target.checked }))}
                      className="w-4 h-4 rounded border-iron-300 text-fifa-purple focus:ring-fifa-purple/40" />
                    <label htmlFor="is_admin" className="text-sm text-iron-700 dark:text-iron-300">Es administrador</label>
                  </div>
                </div>
                <div className="flex gap-3 p-4 border-t border-iron-200 dark:border-iron-700">
                  <button onClick={closeUserModal}
                    className="flex-1 px-4 py-2.5 bg-iron-100 dark:bg-iron-700 text-iron-700 dark:text-iron-200 font-semibold rounded-xl hover:bg-iron-200 dark:hover:bg-iron-600 transition-colors">Cancelar</button>
                  <button onClick={handleSaveUser} disabled={savingUser}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-fifa-purple hover:bg-fifa-purple-dark text-white font-semibold rounded-xl transition-all disabled:opacity-50">
                    {savingUser ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</> : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirm Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-iron-800 rounded-2xl w-full max-w-xs sm:max-w-sm shadow-2xl p-5 sm:p-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Trash2 size={24} className="text-danger" />
                  </div>
                  <h3 className="text-lg font-bold text-iron-900 dark:text-white mb-2">Eliminar Usuario</h3>
                  <p className="text-sm text-iron-500 mb-5">Esta acción no se puede deshacer. Todas las apuestas y datos del usuario serán eliminados.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-4 py-2.5 bg-iron-100 dark:bg-iron-700 text-iron-700 dark:text-iron-200 font-semibold rounded-xl hover:bg-iron-200 dark:hover:bg-iron-600 transition-colors">Cancelar</button>
                    <button onClick={confirmDeleteUser}
                      className="flex-1 px-4 py-2.5 bg-danger hover:bg-red-700 text-white font-semibold rounded-xl transition-colors">Eliminar</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedUserHistory && (
            <UserHistoryModal user={selectedUserHistory} onClose={() => setSelectedUserHistory(null)} />
          )}
        </>
      </div>
  )
}
