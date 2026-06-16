/**
 * Calcula la ganancia potencial de un pronóstico antes de enviarlo a Supabase.
 * Es la lógica que la UI muestra como feedback inmediato al usuario.
 *
 * La fuente autoritativa sigue siendo el RPC `place_bet()` en Supabase
 * (multiplicadores fijos: ganador 2x, empate 3x, resultado exacto 5x).
 * Esta función sirve para:
 *  - Mostrar preview en el modal de apuesta
 *  - Tests de regresión con los multiplicadores base
 *  - Validación de UI
 *
 * @param {number} monto - Monto apostado en puntos
 * @param {'ganador'|'empate'|'resultado_exacto'} tipo - Tipo de apuesta
 * @returns {number} Ganancia potencial (monto × multiplicador)
 */
export const MULTIPLICADORES = {
  ganador: 2.0,
  empate: 3.0,
  resultado_exacto: 5.0,
}

export function calcularGananciaPotencial(monto, tipo) {
  const multiplicador = MULTIPLICADORES[tipo]
  if (multiplicador == null) {
    throw new Error(`Tipo de apuesta inválido: ${tipo}`)
  }
  if (typeof monto !== 'number' || Number.isNaN(monto) || monto < 0) {
    throw new Error(`Monto inválido: ${monto}`)
  }
  return Number(monto) * multiplicador
}
