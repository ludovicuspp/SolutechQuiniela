import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const MIN_CEDULA_DIGITS = 6

export default function LoginPage() {
  const navigate = useNavigate()
  const { signInWithRif } = useAuthStore()

  const [cedula, setCedula] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const cedulaDigits = cedula.replace(/\D/g, '')
  const cedulaValida = cedulaDigits.length >= MIN_CEDULA_DIGITS

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cedulaValida) {
      toast.error('Ingresá una cédula válida (mínimo 6 dígitos)')
      return
    }
    if (!password) {
      toast.error('Ingresá tu contraseña')
      return
    }
    setLoading(true)
    try {
      await signInWithRif(cedulaDigits, password)
      toast.success('¡Bienvenido de vuelta!')
      navigate('/')
    } catch (err) {
      const msg = err.message === 'Invalid login credentials'
        ? 'Credenciales incorrectas'
        : (err.message || 'Error al iniciar sesión')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-iron-900 via-primary-900 to-iron-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/utils/LOGO IRONFLEX PLAY BLANCO.png"
            alt="SolutechQuiniela"
            className="h-14 object-contain mx-auto mb-4"
          />
          <p className="text-iron-400 text-sm">Quiniela Interna · FIFA World Cup 2026</p>
        </div>

        <div className="bg-white dark:bg-iron-800 rounded-2xl shadow-2xl border border-iron-200 dark:border-iron-700 overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-bold text-iron-900 dark:text-white mb-2">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-iron-500 dark:text-iron-400 mb-6">
              Ingresá con tu cédula de identidad y contraseña
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="cedula-input" className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-1">
                  Cédula de Identidad
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-2.5 bg-iron-100 dark:bg-iron-700 rounded-xl border border-iron-200 dark:border-iron-600 text-iron-700 dark:text-iron-200 font-mono font-semibold text-sm shrink-0 select-none">
                    V
                  </div>
                  <input
                    id="cedula-input"
                    type="tel"
                    value={cedula}
                    onChange={e => setCedula(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="input-field flex-1 font-mono"
                    placeholder="12345678"
                    autoComplete="off"
                    required
                  />
                </div>
                <p className="text-xs text-iron-400 mt-1">Ej: 12345678 (solo números)</p>
              </div>

              <div>
                <label htmlFor="password-input" className="block text-sm font-medium text-iron-700 dark:text-iron-300 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password-input"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="Tu contraseña"
                    required
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-iron-400 hover:text-iron-600">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !cedulaValida || !password}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><LogIn size={18} />Iniciar Sesión</>
                )}
              </button>
            </form>

          </div>
        </div>

        <p className="text-center text-iron-500 text-xs mt-6">
          Solo para empleados de Solutech
        </p>
      </div>
    </div>
  )
}
