import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(date) {
  return format(new Date(date), "d 'de' MMMM, yyyy", { locale: es })
}

export function formatDateTime(date) {
  const d = new Date(date)
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return formatter.format(d)
}

export function formatTime(date) {
  const d = new Date(date)
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  return formatter.format(d)
}

export function timeFromNow(date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

// ✅ Obtener fecha de hoy en string (YYYY-MM-DD) usando timezone Venezuela
export function getTodayStringVenezuela() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(now)
  const day = parts.find(p => p.type === 'day').value
  const month = parts.find(p => p.type === 'month').value
  const year = parts.find(p => p.type === 'year').value
  return `${year}-${month}-${day}`
}

// ✅ Obtener hora actual en timezone Venezuela
export function getCurrentHourVenezuela() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const parts = formatter.formatToParts(now)
  const hour = parts.find(p => p.type === 'hour').value
  const minute = parts.find(p => p.type === 'minute').value
  return { hour: parseInt(hour), minute: parseInt(minute) }
}

// ✅ Verificar si es antes de las 12:00 PM (mediodía) en Venezuela
export function isBeforeNoonVenezuela() {
  const { hour } = getCurrentHourVenezuela()
  return hour < 12
}

// ✅ Obtener fecha de mañana en string (YYYY-MM-DD) usando timezone Venezuela
export function getTomorrowStringVenezuela() {
  const todayStr = getTodayStringVenezuela()
  const date = new Date(todayStr)
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
}

// ✅ Obtener rango de hoy (inicio y fin del día en UTC)
export function getTodayRange() {
  const todayStr = getTodayStringVenezuela()
  const start = new Date(`${todayStr}T00:00:00Z`)
  const end = new Date(`${todayStr}T23:59:59Z`)
  return { start, end }
}

// ✅ Obtener rango de mañana (inicio y fin del día en UTC)
export function getTomorrowRange() {
  const tomorrowStr = getTomorrowStringVenezuela()
  const start = new Date(`${tomorrowStr}T00:00:00Z`)
  const end = new Date(`${tomorrowStr}T23:59:59Z`)
  return { start, end }
}

export function formatMoney(amount, decimals = 2) {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export function formatPoints(points) {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(points)
}

export function isMatchBettable(match) {
  return match.estado === 'programado'
}

/**
 * canBetOnMatch — helper de alto nivel que combina ambas restricciones.
 * @param {object} match — objeto match completo (con estado y fecha_partido)
 * @returns {boolean}
 */
export function canBetOnMatch(match) {
  return isMatchBettable(match) && isPronosticoHabilitado(match.fecha_partido)
}

/**
 * Regla de negocio:
 *   - Solo se puede apostar desde las 00:00 del DÍA ANTERIOR al partido.
 *   - La ventana cierra EXACTAMENTE 10 minutos antes de la hora de inicio.
 *   - Comparación por instante absoluto (getTime) — inmune a zona horaria del dispositivo.
 *
 * En producción el time-lock autoritativo vive en place_bet() en Supabase
 * (server-side, no manipulable desde el cliente).
 *
 * @param {string|Date} fechaPartido — fecha del partido (ISO string o Date)
 * @returns {boolean}
 */
export function isPronosticoHabilitado(fechaPartido) {
  const now = new Date()
  const horaPartido = new Date(fechaPartido)

  const horaLimite = new Date(horaPartido.getTime() - 10 * 60000)

  const apertura = new Date(horaPartido)
  apertura.setDate(apertura.getDate() - 1)
  apertura.setHours(0, 0, 0, 0)

  return now >= apertura && now < horaLimite
}

export function getFaseLabel(fase) {
  const labels = {
    grupo: 'Fase de Grupos',
    repechaje: 'Repechaje',
    dieciseisavos: 'Dieciseisavos de Final',
    octavos: 'Octavos de Final',
    cuartos: 'Cuartos de Final',
    semifinal: 'Semifinales',
    tercer_puesto: 'Tercer Puesto',
    final: 'Final',
  }
  return labels[fase] || fase
}

export function getEstadoLabel(estado) {
  const labels = {
    programado: 'Programado',
    en_juego: 'En Juego',
    finalizado: 'Finalizado',
    suspendido: 'Suspendido',
    pospuesto: 'Pospuesto',
  }
  return labels[estado] || estado
}

export function getBetTypeLabel(tipo) {
  const labels = {
    ganador: 'Ganador',
    empate: 'Empate',
    resultado_exacto: 'Resultado Exacto',
  }
  return labels[tipo] || tipo
}

export function getBetStatusColor(estado) {
  const colors = {
    pendiente: 'text-accent-400',
    ganada: 'text-success',
    perdida: 'text-danger',
    reembolsada: 'text-primary-400',
  }
  return colors[estado] || 'text-iron-400'
}

// ✅ Normalizar RIF: convierte cualquier formato al esperado (sin guiones/puntos)
export function normalizarRif(rif) {
  if (!rif) return ''
  
  // Convertir a mayúsculas y eliminar espacios en blanco
  let normalized = rif.trim().toUpperCase()
  
  // Eliminar guiones, puntos y otros caracteres especiales, mantener solo letras y números
  normalized = normalized.replace(/[-.\s]/g, '')
  
  // ✅ Si es solo números, asumir que es V (cédula venezolana)
  if (/^\d+$/.test(normalized)) {
    normalized = 'V' + normalized
  }
  
  // Validar que empiece con letra (V, J, E, P, G) y siga con números
  if (!/^[VJEPG]\d+$/.test(normalized)) {
    return null  // RIF inválido
  }
  
  return normalized
}

// ✅ Validar formato de RIF
export function esRifValido(rif) {
  return normalizarRif(rif) !== null
}
