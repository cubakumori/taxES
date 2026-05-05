import { describe, expect, it } from 'vitest'
import {
  BCE_CURRENCIES,
  BCE_UPDATED_AT,
  getBceRateToEur,
  isBceSupported,
} from './bce'

describe('BCE rates bundle', () => {
  it('incluye las divisas principales de IBKR', () => {
    for (const code of ['USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD']) {
      expect(BCE_CURRENCIES.has(code)).toBe(true)
    }
  })

  it('exporta un timestamp de actualización ISO', () => {
    expect(BCE_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('isBceSupported', () => {
  it('EUR siempre soportado', () => {
    expect(isBceSupported('EUR')).toBe(true)
  })

  it('USD y GBP soportados', () => {
    expect(isBceSupported('USD')).toBe(true)
    expect(isBceSupported('GBP')).toBe(true)
  })

  it('TWD no soportado (ECB no lo publica)', () => {
    expect(isBceSupported('TWD')).toBe(false)
  })

  it('divisa inexistente no soportada', () => {
    expect(isBceSupported('XXX')).toBe(false)
  })
})

describe('getBceRateToEur', () => {
  it('EUR devuelve rate 1', () => {
    const r = getBceRateToEur('EUR', '2025-04-10')
    expect(r?.rate).toBe(1)
    expect(r?.fxDate).toBe('2025-04-10')
  })

  it('USD devuelve un rate plausible para fecha hábil 2025', () => {
    const r = getBceRateToEur('USD', '2025-04-10')
    expect(r).not.toBeNull()
    // EUR/USD en 2025 ronda 1.05-1.15, por lo que USD→EUR ronda 0.87-0.95
    expect(r!.rate).toBeGreaterThan(0.8)
    expect(r!.rate).toBeLessThan(1.0)
  })

  it('hace fallback al día hábil anterior en fin de semana', () => {
    // 2025-04-12 es sábado → debería usar 2025-04-11 (viernes)
    const weekend = getBceRateToEur('USD', '2025-04-12')
    const friday = getBceRateToEur('USD', '2025-04-11')
    expect(weekend).not.toBeNull()
    expect(friday).not.toBeNull()
    expect(weekend!.fxDate).toBe('2025-04-11')
    expect(weekend!.rate).toBe(friday!.rate)
  })

  it('devuelve null para divisa no soportada', () => {
    expect(getBceRateToEur('TWD', '2025-04-10')).toBeNull()
    expect(getBceRateToEur('XXX', '2025-04-10')).toBeNull()
  })

  it('devuelve null para formato de fecha inválido', () => {
    expect(getBceRateToEur('USD', '10-04-2025')).toBeNull()
    expect(getBceRateToEur('USD', 'no-es-fecha')).toBeNull()
  })

  it('devuelve null para fechas anteriores al histórico (pre-2020)', () => {
    expect(getBceRateToEur('USD', '2015-01-01')).toBeNull()
  })
})
