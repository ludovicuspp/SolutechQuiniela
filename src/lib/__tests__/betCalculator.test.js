import { describe, it, expect } from 'vitest'
import { calcularGananciaPotencial, MULTIPLICADORES } from '../betCalculator.js'

describe('calcularGananciaPotencial - Lógica de pronóstico y multiplicadores', () => {
  // 🛡️ Multiplicadores fijos: la fuente autoritativa es el RPC `place_bet()` en Supabase.
  describe('Con monto = 100', () => {
    it('✅ Ganador debe retornar 200 (multiplicador 2.0x)', () => {
      expect(calcularGananciaPotencial(100, 'ganador')).toBe(200)
    })

    it('✅ Empate debe retornar 300 (multiplicador 3.0x)', () => {
      expect(calcularGananciaPotencial(100, 'empate')).toBe(300)
    })

    it('✅ Resultado exacto debe retornar 500 (multiplicador 5.0x)', () => {
      expect(calcularGananciaPotencial(100, 'resultado_exacto')).toBe(500)
    })
  })

  describe('Tabla de multiplicadores base', () => {
    it('exponer los multiplicadores base correctos', () => {
      expect(MULTIPLICADORES.ganador).toBe(2.0)
      expect(MULTIPLICADORES.empate).toBe(3.0)
      expect(MULTIPLICADORES.resultado_exacto).toBe(5.0)
    })
  })

  describe('Casos borde', () => {
    it('monto 0 debe retornar 0 (sin ganancia, sin pérdida)', () => {
      expect(calcularGananciaPotencial(0, 'ganador')).toBe(0)
    })

    it('monto decimal debe calcular correctamente', () => {
      expect(calcularGananciaPotencial(50.5, 'ganador')).toBe(101)
    })

    it('debe lanzar error si el tipo es inválido', () => {
      expect(() => calcularGananciaPotencial(100, 'inventado'))
        .toThrow(/Tipo de apuesta inválido/)
    })

    it('debe lanzar error si el monto es negativo', () => {
      expect(() => calcularGananciaPotencial(-50, 'ganador'))
        .toThrow(/Monto inválido/)
    })

    it('debe lanzar error si el monto es NaN', () => {
      expect(() => calcularGananciaPotencial(NaN, 'ganador'))
        .toThrow(/Monto inválido/)
    })
  })
})
