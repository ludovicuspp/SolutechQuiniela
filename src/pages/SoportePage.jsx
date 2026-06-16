import { Clock, Target, Trophy, Plus } from 'lucide-react'

const WA_URL = 'https://wa.me/584143618980?text=Hola,%20necesito%20soporte%20con%20SolutechQuiniela'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.879-.79-1.034-1.682-.588-1.905.446-.223 1.04-.69 1.39-1.355.297-.597.297-.91.074-1.173-.222-.263-.445-.744-.78-1.24-.278-.406-.465-.729-.993-1.024-.522-.291-1.002-.339-1.407-.203-.405.136-.633.596-.633 1.254s.61 1.475.762 1.706c.153.231.51.745.867 1.21.356.465.759 1.083.857 1.274.096.191.096.366-.022.57l-.197.493c-.149.446-.297.893-.446 1.125-.148.232.075.363.333.447.252.082.892.396 1.756.952.864.556 1.075 1.262 1.192 1.465.117.203.185.419-.023.666zM12 0C5.373 0 0 5.373 0 12c0 2.11.548 4.128 1.575 5.891L0 24l6.373-1.672A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.744c-1.022 0-2.007-.259-2.893-.757l-.208-.116-4.364 1.145.29-1.682-.14-.223A9.69 9.69 0 0 1 2.256 12C2.256 6.637 6.637 2.256 12 2.256S21.744 6.637 21.744 12 17.363 21.744 12 21.744z" />
  </svg>
)

const REGLAS = [
  {
    icon: Target,
    title: 'Puntos asignados',
    desc: 'Tus puntos son asignados por la empresa. Puedes usarlos para hacer pronósticos y ganar más puntos.',
  },
  {
    icon: Clock,
    title: 'Multiplicadores',
    desc: 'Elige tu tipo de pronóstico y multiplica tus puntos apostados según el nivel de riesgo que estés dispuesto a asumir.',
  },
  {
    icon: Trophy,
    title: 'Cierre de pronósticos',
    desc: 'Puedes apostar desde el día anterior al partido hasta exactamente 10 minutos antes de que comience el juego.',
  },
]

const MULTIPLIER_DETAIL = [
  {
    tipo: 'Ganador',
    multiplicador: 'x2',
    riesgo: 'Bajo',
    riesgoColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    desc: 'Elige qué equipo gana o si empatan. Es la opción más segura: adivina el resultado general del partido.',
    ejemplo: 'México 2 - 1 Sudán → si aciertas el ganador, duplicas tus puntos.',
  },
  {
    tipo: 'Empate',
    multiplicador: 'x3',
    riesgo: 'Medio',
    riesgoColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    desc: 'Apuesta a que el partido termina en empate. Más difícil que predecir al ganador, por eso el multiplicador es mayor.',
    ejemplo: 'Francia 1 - 1 Portugal → si aciertas el empate, triplicas tus puntos.',
  },
  {
    tipo: 'Resultado Exacto',
    multiplicador: 'x5',
    riesgo: 'Alto',
    riesgoColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    desc: 'Adivina el marcador exacto: equipos y goles. Es el más difícil, pero multiplica por 5 tus puntos apostados.',
    ejemplo: 'Argentina 2 - 0 Brasil → si aciertas el marcador exacto, quintuplicas tus puntos.',
  },
]

const PASOS = [
  {
    icon: Plus,
    label: 'Recibe puntos',
    num: '01',
    color: 'bg-fifa-blue',
  },
  {
    icon: Target,
    label: 'Pronostica',
    num: '02',
    color: 'bg-fifa-orange',
  },
  {
    icon: Trophy,
    label: 'Gana',
    num: '03',
    color: 'bg-fifa-red',
  },
]

export default function SoportePage() {
  return (
    <div className="min-h-screen bg-iron-50 dark:bg-iron-950 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-white font-bold text-base shadow-md hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#25d366' }}
        >
          <WhatsAppIcon />
          Contactar por WhatsApp
        </a>

        <h1 className="text-2xl font-extrabold text-iron-900 dark:text-white">
          Guía de Usuario y Reglas de SolutechQuiniela
        </h1>

        <div className="space-y-3">
          {REGLAS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Icon size={20} className="text-primary-500" />
              </div>
              <div>
                <p className="font-bold text-iron-900 dark:text-white">{title}</p>
                <p className="text-sm text-iron-600 dark:text-iron-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-iron-900 dark:text-white">
            Multiplicadores por tipo de pronóstico
          </h2>
          {MULTIPLIER_DETAIL.map(({ tipo, multiplicador, riesgo, riesgoColor, desc, ejemplo }) => (
            <div key={tipo} className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-iron-900 dark:text-white">{tipo}</span>
                <span className="text-lg font-extrabold text-accent-500">{multiplicador}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riesgoColor}`}>
                  Riesgo {riesgo}
                </span>
              </div>
              <p className="text-sm text-iron-600 dark:text-iron-400">{desc}</p>
              <p className="text-xs text-iron-500 dark:text-iron-500 italic">{ejemplo}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-iron-900 dark:text-white">
            Cómo jugar
          </h2>
          <div className="flex items-stretch justify-between gap-2">
            {PASOS.map(({ icon: Icon, label, num, color }, i) => (
              <div key={num} className="flex flex-col items-center flex-1 relative">
                <div className="w-full flex justify-center mb-2">
                  <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center relative z-10`}>
                    <Icon size={22} className="text-white" />
                  </div>
                </div>
                <span className="text-xs font-extrabold text-iron-600 dark:text-iron-300 mb-1">{num}</span>
                <span className="text-sm font-semibold text-center text-iron-800 dark:text-iron-200 leading-tight">{label}</span>
                {i < PASOS.length - 1 && (
                  <div className="absolute top-6 left-[55%] right-0 h-0.5 bg-iron-200 dark:bg-iron-700 z-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
          <div className="card text-sm text-iron-600 dark:text-iron-400 space-y-1">
            <p><span className="font-semibold text-iron-800 dark:text-iron-200">1. Recibe puntos</span> — La empresa te asigna puntos directamente. Puedes ver tu saldo en la sección Wallet.</p>
            <p><span className="font-semibold text-iron-800 dark:text-iron-200">2. Pronostica</span> — Elige tus partidos y coloca tu pronóstico antes del cierre.</p>
            <p><span className="font-semibold text-iron-800 dark:text-iron-200">3. Gana</span> — Si tu pronóstico es correcto, ¡recibe tus puntos multiplicados!</p>
          </div>
        </div>

      </div>
    </div>
  )
}
