import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_STATEMENT_WITH_BUYS_2024,
  ACTIVITY_STATEMENT_WITH_SELLS_2025,
} from '../__fixtures__'
import { parseIbkrActivityStatement } from '../parser/ibkr/activity-statement'
import { computeFifoGains } from './fifo'

function parsePair() {
  const prior = parseIbkrActivityStatement(ACTIVITY_STATEMENT_WITH_BUYS_2024)
  const current = parseIbkrActivityStatement(ACTIVITY_STATEMENT_WITH_SELLS_2025)
  return { prior, current }
}

describe('computeFifoGains — single year', () => {
  it('no emite filas si no hay ventas en el año', () => {
    const { prior } = parsePair()
    const res = computeFifoGains([prior], 2024)
    expect(res.summary.rows).toHaveLength(0)
    expect(res.summary.netoEur).toBe(0)
  })

  it('APLE: compra, venta con pérdida, y recompra en ventana → flag anti-elusión', () => {
    const { current } = parsePair()
    const res = computeFifoGains([current], 2025)
    const aple = res.summary.rows.find((r) => r.symbol === 'APLE')
    expect(aple).toBeDefined()
    // Compra 100 @ 15 + 1 comisión = 1501; venta 100 @ 13 − 1 comisión = 1299.
    expect(aple?.saleProceedsEur).toBeCloseTo(1299, 2)
    expect(aple?.acquisitionCostEur).toBeCloseTo(1501, 2)
    expect(aple?.gainLossEur).toBeCloseTo(-202, 2)
    expect(aple?.antiElusionFlag).toBe(true)
    expect(
      res.notices.some((n) => n.code === 'fifo-anti-elusion'),
    ).toBe(true)
  })

  it('UCB: venta sin compras previas → marca hasIncompleteBasis y emite warning', () => {
    const { current } = parsePair()
    const res = computeFifoGains([current], 2025)
    const ucb = res.summary.rows.find((r) => r.symbol === 'UCB')
    expect(ucb).toBeDefined()
    expect(ucb?.hasIncompleteBasis).toBe(true)
    expect(ucb?.acquisitionCostEur).toBe(0)
    expect(ucb?.saleProceedsEur).toBeCloseTo(799, 2)
    expect(
      res.notices.some((n) => n.code === 'fifo-incomplete-basis'),
    ).toBe(true)
  })
})

describe('computeFifoGains — multi-año (priorDocs)', () => {
  it('ENG: el sell de 80 en 2025 consume del lote 2024 (FIFO, no del 2025)', () => {
    const { prior, current } = parsePair()
    const res = computeFifoGains([prior, current], 2025)
    const eng = res.summary.rows.find((r) => r.symbol === 'ENG')
    expect(eng).toBeDefined()
    // Venta 80 × 15,00 = 1200, comisión 1,50 → proceeds 1198,50.
    expect(eng?.saleProceedsEur).toBeCloseTo(1198.5, 2)
    // FIFO: consume 80 del lote 2024-03-10 (100 @ 1002/100 = 10,02) →
    // coste 80 × 10,02 = 801,60.
    expect(eng?.acquisitionCostEur).toBeCloseTo(801.6, 2)
    expect(eng?.gainLossEur).toBeCloseTo(396.9, 2)
    expect(eng?.hasIncompleteBasis).toBe(false)
    expect(eng?.acquisitionFrom).toBe('2024-03-10')
  })

  it('MO: venta total 20 consume el lote 2024 completo (coste 801)', () => {
    const { prior, current } = parsePair()
    const res = computeFifoGains([prior, current], 2025)
    const mo = res.summary.rows.find((r) => r.symbol === 'MO')
    expect(mo).toBeDefined()
    expect(mo?.saleProceedsEur).toBeCloseTo(999, 2)
    expect(mo?.acquisitionCostEur).toBeCloseTo(801, 2)
    expect(mo?.gainLossEur).toBeCloseTo(198, 2)
    expect(mo?.hasIncompleteBasis).toBe(false)
  })

  it('cambiar el orden de los docs priorDocs no altera el resultado', () => {
    const { prior, current } = parsePair()
    const a = computeFifoGains([prior, current], 2025)
    const b = computeFifoGains([current, prior], 2025)
    expect(a.summary.netoEur).toBeCloseTo(b.summary.netoEur, 2)
    expect(a.summary.rows.length).toBe(b.summary.rows.length)
  })
})

describe('computeFifoGains — totales', () => {
  it('suma ganancias y pérdidas del ejercicio', () => {
    const { prior, current } = parsePair()
    const res = computeFifoGains([prior, current], 2025)
    // Ganancias: ENG 396,90 + MO 198,00 + UCB 799,00 (sin base) = 1393,90.
    // Pérdida: APLE 202,00.
    expect(res.summary.totalGananciasEur).toBeCloseTo(1393.9, 2)
    expect(res.summary.totalPerdidasEur).toBeCloseTo(202, 2)
    expect(res.summary.netoEur).toBeCloseTo(1191.9, 2)
  })

  it('incluye el aviso informativo de acciones corporativas fuera de alcance', () => {
    const { prior, current } = parsePair()
    const res = computeFifoGains([prior, current], 2025)
    expect(
      res.notices.some((n) => n.code === 'fifo-corporate-actions-oos'),
    ).toBe(true)
  })
})
