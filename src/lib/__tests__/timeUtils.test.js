import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isPronosticoHabilitado } from '../../utils/formatters.js'

// Partido de prueba: 15 de junio de 2026 a las 18:00 VEN
// (= 2026-06-15T22:00:00Z, ya que VEN es UTC-4)
// Regla: desde 00:00 del día anterior hasta strictly MENOS 10 min antes del partido.
// now >= horaLimite → ventana CERRADA.
// Con horaLimite = T-10min (21:50 UTC):
//   - T-11 (21:49 UTC) → true (último momento válido)
//   - T-10 (21:50 UTC) → false (ya cerró)
//   - T-9  (21:51 UTC) → false
const FECHA_PARTIDO = '2026-06-15T22:00:00Z'  // 18:00 VEN

// Día antes a las 19:00 VEN (jun 14 19:00 VEN = jun 14 23:00 UTC) → ✓
const ESC_EN_DIA_ANTES = '2026-06-14T23:00:00Z'

// T-11 (jun 15 17:49 VEN = jun 15 21:49 UTC) → ✓ último momento válido
const ESC_11_MIN_ANTES = '2026-06-15T21:49:00Z'

// T-10 exacto (jun 15 17:50 VEN = jun 15 21:50 UTC) → ✗ ventana cerrada
const ESC_10_MIN_ANTES = '2026-06-15T21:50:00Z'

// T-9 (jun 15 17:51 VEN = jun 15 21:51 UTC) → ✗窗口 cerrada
const ESC_9_MIN_ANTES = '2026-06-15T21:51:00Z'

// 2 días antes (jun 13 19:00 VEN = jun 13 23:00 UTC) → ✗ antes de apertura
const ESC_2_DIAS_ANTES = '2026-06-13T23:00:00Z'

describe('isPronosticoHabilitado - Candado de 10 minutos', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('✅ Día antes a las 19:00 VEN → ventana abierta', () => {
    vi.setSystemTime(new Date(ESC_EN_DIA_ANTES))
    expect(isPronosticoHabilitado(FECHA_PARTIDO)).toBe(true)
  })

  it('✅ T-11 (17:49 VEN) → último momento válido antes del cierre', () => {
    vi.setSystemTime(new Date(ESC_11_MIN_ANTES))
    expect(isPronosticoHabilitado(FECHA_PARTIDO)).toBe(true)
  })

  it('❌ T-10 exacto (17:50 VEN) → ventana CERRADA', () => {
    vi.setSystemTime(new Date(ESC_10_MIN_ANTES))
    expect(isPronosticoHabilitado(FECHA_PARTIDO)).toBe(false)
  })

  it('❌ T-9 (17:51 VEN) →窗口 ya cerrada', () => {
    vi.setSystemTime(new Date(ESC_9_MIN_ANTES))
    expect(isPronosticoHabilitado(FECHA_PARTIDO)).toBe(false)
  })

  it('❌ 2 días antes → antes de la apertura', () => {
    vi.setSystemTime(new Date(ESC_2_DIAS_ANTES))
    expect(isPronosticoHabilitado(FECHA_PARTIDO)).toBe(false)
  })
})
