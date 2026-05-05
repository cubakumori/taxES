/**
 * Tipos de cambio de referencia del Banco Central Europeo.
 *
 * Convención ECB: `1 EUR = X <currency>`. Para convertir X-divisa a EUR hay
 * que dividir entre el rate (o equivalentemente multiplicar por su inverso).
 *
 * Weekends y festivos: el ECB no publica esos días. Si el evento cae en
 * sábado/domingo/festivo, se hace fallback al anterior día hábil hasta 7 días
 * atrás (criterio conservador aceptado por AEAT).
 *
 * Para refrescar la data: `npm run fx:update`.
 */

import bundle from './bce-rates.json'

interface Bundle {
  updatedAt: string
  currencies: string[]
  rates: Record<string, Record<string, number>>
}

const DATA = bundle as Bundle

export const BCE_UPDATED_AT = DATA.updatedAt
export const BCE_CURRENCIES: ReadonlySet<string> = new Set(DATA.currencies)

export interface BceRateResolution {
  /** Multiplicador para convertir: `eur = amount * rate`. */
  rate: number
  /** Fecha efectiva del tipo (puede ser anterior si era weekend/festivo). */
  fxDate: string
}

/**
 * Busca el tipo de cambio `currency → EUR` para una fecha, tolerando
 * fines de semana/festivos mediante fallback al día hábil anterior.
 * Devuelve `null` si no hay rate disponible (divisa no soportada o fecha
 * fuera de rango).
 */
export function getBceRateToEur(
  currency: string,
  date: string,
): BceRateResolution | null {
  if (currency === 'EUR') return { rate: 1, fxDate: date }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!BCE_CURRENCIES.has(currency)) return null

  const target = new Date(`${date}T00:00:00Z`)
  for (let i = 0; i < 7; i++) {
    const iso = target.toISOString().slice(0, 10)
    const dayRates = DATA.rates[iso]
    if (dayRates && typeof dayRates[currency] === 'number') {
      return { rate: 1 / dayRates[currency], fxDate: iso }
    }
    target.setUTCDate(target.getUTCDate() - 1)
  }
  return null
}

export function isBceSupported(currency: string): boolean {
  return currency === 'EUR' || BCE_CURRENCIES.has(currency)
}
