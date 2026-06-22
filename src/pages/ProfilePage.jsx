import { useState } from 'react'
import { User, Building2, MapPin, Phone, Mail, Shield, Sun, Moon, Edit3, LogOut, X } from 'lucide-react'
import SupportFab from '../components/layout/SupportFab'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { supabase } from '../lib/supabase'
import { formatPoints, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, profile, wallet, signOut, loadProfile } = useAuthStore()
  const { dark, toggle } = useThemeStore()

  const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'

  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editProfileForm, setEditProfileForm] = useState({
    nombre: '',
    alias: '',
    telefono: '',
    zona: '',
    vendedor: '',
    empresa: ''
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const openEditProfileModal = () => {
    setEditProfileForm({
      nombre: profile?.nombre || '',
      alias: profile?.alias || '',
      telefono: profile?.telefono || '',
      zona: profile?.zona || '',
      vendedor: profile?.vendedor || '',
      empresa: profile?.empresa || ''
    })
    setShowEditProfileModal(true)
  }

  const closeEditProfileModal = () => {
    setShowEditProfileModal(false)
    setEditProfileForm({ nombre: '', alias: '', telefono: '', zona: '', vendedor: '', empresa: '' })
  }

  const handleSaveProfile = async () => {
    if (!editProfileForm.nombre.trim()) { toast.error('El nombre es requerido'); return }
    if (!editProfileForm.alias.trim()) { toast.error('El alias es requerido para el ranking'); return }

    setSavingProfile(true)
    try {
      const updatePayload = {
        nombre: editProfileForm.nombre,
        alias: editProfileForm.alias.trim(),
        telefono: editProfileForm.telefono,
        zona: editProfileForm.zona,
        vendedor: editProfileForm.vendedor,
        empresa: editProfileForm.empresa
      }
      const { error } = await supabase.from('users').update(updatePayload).eq('id', profile?.id)
      if (error) throw error
      toast.success('Perfil actualizado correctamente')
      closeEditProfileModal()
      if (profile?.id) await loadProfile(profile.id)
    } catch (err) {
      toast.error(err.message || 'Error actualizando el perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  const infoItems = [
    { icon: Building2, label: 'Empresa', value: profile?.empresa || profile?.nombre },
    { icon: Shield, label: 'Cédula', value: profile?.rif },
    { icon: Phone, label: 'Teléfono', value: profile?.telefono },
    { icon: Mail, label: 'Email', value: user?.email },
    { icon: MapPin, label: 'Zona', value: profile?.zona },
    { icon: User, label: 'Vendedor', value: profile?.vendedor },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <h1 className="text-2xl font-bold text-iron-900 dark:text-white flex items-center gap-2">
        <User size={24} className="text-primary-500" />
        Mi Perfil
      </h1>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{profile?.nombre?.charAt(0) || '?'}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-iron-900 dark:text-white">{profile?.nombre}</h2>
            <p className="text-sm text-iron-500">Miembro desde {profile?.created_at ? formatDate(profile.created_at) : ''}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 p-3 bg-iron-50 dark:bg-iron-700/30 rounded-xl">
              <Icon size={18} className="text-primary-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-iron-500">{label}</p>
                <p className="text-sm font-medium text-iron-900 dark:text-white truncate">{value || 'No disponible'}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={openEditProfileModal}
          className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors">
          <Edit3 size={18} /> Editar Mis Datos
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-4">Preferencias</h2>
        <div className="flex items-center justify-between p-4 bg-iron-50 dark:bg-iron-700/30 rounded-xl">
          <div className="flex items-center gap-3">
            {dark ? <Moon size={20} className="text-primary-500" /> : <Sun size={20} className="text-primary-500" />}
            <div>
              <p className="text-sm font-medium text-iron-900 dark:text-white">Modo Oscuro</p>
              <p className="text-xs text-iron-500">{dark ? 'Activo' : 'Inactivo'}</p>
            </div>
          </div>
          <button onClick={toggle}
            className={`relative w-14 h-7 rounded-full transition-colors ${dark ? 'bg-primary-500' : 'bg-iron-300 dark:bg-iron-600'}`}>
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? 'left-8' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-iron-900 dark:text-white mb-4">Resumen de Cuenta</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-700">
            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{formatPoints(wallet?.balance || 0)}</p>
            <p className="text-xs text-iron-600 dark:text-iron-400 mt-1 font-medium">Saldo Disponible</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <p className="text-xl font-bold text-success">{formatPoints(wallet?.total_earned || 0)}</p>
            <p className="text-xs text-iron-600 dark:text-iron-400 mt-1 font-medium">Comprado</p>
          </div>
          <div className="text-center p-3 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
            <p className="text-xl font-bold text-accent-500">{formatPoints(wallet?.total_wagered || 0)}</p>
            <p className="text-xs text-iron-600 dark:text-iron-400 mt-1 font-medium">Jugado</p>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-fifa-green/20 to-fifa-green/10 dark:from-fifa-green/30 dark:to-fifa-green/10 rounded-xl border border-fifa-green/40 dark:border-fifa-green/50">
            <p className="text-xl font-bold text-fifa-green">{formatPoints(wallet?.total_won || 0)}</p>
            <p className="text-xs font-bold text-fifa-green dark:text-fifa-green uppercase tracking-wide mt-1">Para Ranking</p>
          </div>
        </div>
      </div>

      <button onClick={signOut}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-fifa-red/10 hover:bg-fifa-red/20 dark:bg-fifa-red/20 dark:hover:bg-fifa-red/30 text-fifa-red font-semibold rounded-xl transition-colors">
        <LogOut size={18} /> Cerrar Sesión
      </button>

      <p className="text-xs text-gray-500/50 dark:text-gray-400/50 text-center mt-8 pb-4 font-mono">SolutechQuiniela v{appVersion}</p>

      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-iron-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-iron-200 dark:border-iron-700">
              <h3 className="text-lg font-bold text-iron-900 dark:text-white">Editar Mi Perfil</h3>
              <button onClick={closeEditProfileModal} className="p-1 text-iron-400 hover:text-iron-600 dark:hover:text-iron-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Nombre Completo *</label>
                <input type="text" value={editProfileForm.nombre} onChange={e => setEditProfileForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Alias (visible en el Ranking) *</label>
                <input type="text" value={editProfileForm.alias} onChange={e => setEditProfileForm(f => ({ ...f, alias: e.target.value }))}
                  placeholder="Ej: ElTigreMaracaibo" maxLength={30}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
                <p className="text-xs text-iron-500 mt-1">Este nombre es visible en el ranking público</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-500 dark:text-iron-400 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2.5 bg-iron-100 dark:bg-iron-700/30 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-400 dark:text-iron-500 text-sm cursor-not-allowed opacity-60"
                />
                <p className="text-xs text-iron-400 dark:text-iron-500 mt-1">El correo no se puede modificar</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Teléfono</label>
                <input type="text" value={editProfileForm.telefono} onChange={e => setEditProfileForm(f => ({ ...f, telefono: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Zona</label>
                <input type="text" value={editProfileForm.zona} onChange={e => setEditProfileForm(f => ({ ...f, zona: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Vendedor</label>
                <input type="text" value={editProfileForm.vendedor} onChange={e => setEditProfileForm(f => ({ ...f, vendedor: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-iron-600 dark:text-iron-400 mb-1">Empresa</label>
                <input type="text" value={editProfileForm.empresa} onChange={e => setEditProfileForm(f => ({ ...f, empresa: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-iron-50 dark:bg-iron-700/50 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-iron-200 dark:border-iron-700">
              <button onClick={closeEditProfileModal}
                className="flex-1 px-4 py-2.5 bg-iron-100 dark:bg-iron-700 text-iron-700 dark:text-iron-200 font-semibold rounded-xl hover:bg-iron-200 dark:hover:bg-iron-600 transition-colors">Cancelar</button>
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50">
                {savingProfile ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SupportFab />
    </div>
  )
}
