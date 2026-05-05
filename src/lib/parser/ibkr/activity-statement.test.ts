import { describe, expect, it } from 'vitest'
import { ACTIVITY_STATEMENT_BASIC_2025 } from '../../__fixtures__'
import type {
  CashTransactionEvent,
  FeeEvent,
  TradeEvent,
} from '../types'
import { parseIbkrActivityStatement } from './activity-statement'

describe('parseIbkrActivityStatement', () => {
  it('extrae la info de cuenta y período', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    expect(doc.accountInfo.accountId).toBe('U…234')
    expect(doc.accountInfo.baseCurrency).toBe('EUR')
    expect(doc.accountInfo.periodFrom).toBe('2025-01-01')
    expect(doc.accountInfo.periodTo).toBe('2025-12-31')
    expect(doc.taxYear).toBe(2025)
  })

  it('parsea los trades con dirección correcta', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const trades = doc.events.filter(
      (e): e is TradeEvent => e.kind === 'trade',
    )
    expect(trades).toHaveLength(2)
    expect(trades.every((t) => t.side === 'buy')).toBe(true)
    const eng = trades.find((t) => t.instrument.symbol === 'ENG')
    expect(eng?.quantity).toBe(50)
    expect(eng?.gross.currency).toBe('EUR')
    expect(eng?.gross.eur).toBeCloseTo(700, 2)
  })

  it('enriquece el instrumento con ISIN y país emisor desde el catálogo', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const trades = doc.events.filter(
      (e): e is TradeEvent => e.kind === 'trade',
    )
    const mo = trades.find((t) => t.instrument.symbol === 'MO')
    expect(mo?.instrument.isin).toBe('US02209S1033')
    expect(mo?.instrument.countryOfIssuer).toBe('US')
    expect(mo?.instrument.name).toBe('ALTRIA GROUP INC')
  })

  it('clasifica fees por tipo (custody, adr-fee)', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const fees = doc.events.filter((e): e is FeeEvent => e.kind === 'fee')
    expect(fees).toHaveLength(2)
    const custody = fees.find((f) => f.feeType === 'custody')
    const adr = fees.find((f) => f.feeType === 'adr-fee')
    expect(custody).toBeDefined()
    expect(adr).toBeDefined()
  })

  it('extrae movimientos de caja', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const cash = doc.events.filter(
      (e): e is CashTransactionEvent => e.kind === 'cash-transaction',
    )
    expect(cash).toHaveLength(1)
    expect(cash[0].txType).toBe('deposit')
    expect(cash[0].amount.eur).toBeCloseTo(1000, 2)
  })

  it('extrae los sourceTotals desde las filas "Total … en EUR"', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    expect(doc.sourceTotals?.dividendGrossEur).toBeCloseTo(119.95, 2)
    expect(doc.sourceTotals?.withholdingEur).toBeCloseTo(19.4, 2)
  })

  it('resuelve FX a EUR vía BCE para divisas soportadas (USD)', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const trades = doc.events.filter(
      (e): e is TradeEvent => e.kind === 'trade',
    )
    const moTrade = trades.find(
      (t) => t.instrument.symbol === 'MO' && t.gross.currency === 'USD',
    )
    // El trade MO tiene Productos 550 USD. Con BCE USD ~1.05-1.10 EUR → eur ~500-525.
    expect(moTrade).toBeDefined()
    expect(moTrade!.gross.eur).toBeGreaterThan(400)
    expect(moTrade!.gross.eur).toBeLessThan(600)
    expect(moTrade!.gross.fxRate).toBeGreaterThan(0)
  })

  it('no emite fx-rate-missing cuando todas las divisas están soportadas', () => {
    const doc = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const fxMissing = doc.warnings.filter((w) => w.code === 'fx-rate-missing')
    expect(fxMissing).toHaveLength(0)
  })
})
