import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_STATEMENT_BASIC_2025,
  DIVIDEND_REPORT_BASIC_2025,
} from '../__fixtures__'
import { parseIbkrActivityStatement } from './ibkr/activity-statement'
import { parseIbkrDividendReport } from './ibkr/dividend-report'
import { mergeIbkrStatements } from './merge'
import type { DividendEvent, TradeEvent } from './types'

describe('mergeIbkrStatements', () => {
  it('devuelve null si no hay fuentes', () => {
    expect(mergeIbkrStatements(null, null)).toBeNull()
  })

  it('envuelve una única fuente cuando no hay Activity Statement', () => {
    const div = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const merged = mergeIbkrStatements(div, null)
    expect(merged?.sources).toHaveLength(1)
    expect(merged?.sources[0].type).toBe('dividend-report')
    expect(merged?.crossValidation).toBeUndefined()
  })

  it('combina eventos de ambas fuentes sin duplicar dividendos', () => {
    const div = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const act = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const merged = mergeIbkrStatements(div, act)

    // Dividendos vienen del DividendReport
    const divEvents = merged!.events.filter(
      (e): e is DividendEvent => e.kind === 'dividend',
    )
    expect(divEvents.length).toBe(
      div.events.filter((e) => e.kind === 'dividend').length,
    )

    // Trades vienen del Activity Statement
    const trades = merged!.events.filter(
      (e): e is TradeEvent => e.kind === 'trade',
    )
    expect(trades).toHaveLength(2)
  })

  it('enriquece instrumentos de DividendReport con ISIN/nombre del Activity Statement', () => {
    const div = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const act = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const merged = mergeIbkrStatements(div, act)
    const mo = merged!.events.find(
      (e): e is DividendEvent =>
        e.kind === 'dividend' && e.instrument.symbol === 'MO',
    )
    expect(mo?.instrument.isin).toBe('US02209S1033')
    expect(mo?.instrument.name).toBe('ALTRIA GROUP INC')
  })

  it('produce un cross-validation coherente cuando los totales cuadran', () => {
    const div = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const act = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const merged = mergeIbkrStatements(div, act)
    const cv = merged!.crossValidation!
    expect(cv.available).toBe(true)
    expect(cv.dividendGrossEur.match).toBe(true)
    expect(Math.abs(cv.dividendGrossEur.diff)).toBeLessThan(0.1)
  })

  it('detecta discrepancia en totales cuando difieren por encima del umbral', () => {
    const div = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    // Fabricar un activity doc con totales distintos sin re-parsear.
    const act = parseIbkrActivityStatement(ACTIVITY_STATEMENT_BASIC_2025)
    const tampered = {
      ...act,
      sourceTotals: {
        ...act.sourceTotals,
        dividendGrossEur: (act.sourceTotals?.dividendGrossEur ?? 0) + 1,
      },
    }
    const merged = mergeIbkrStatements(div, tampered)
    const cv = merged!.crossValidation!
    expect(cv.dividendGrossEur.match).toBe(false)
    expect(cv.overallMatch).toBe(false)
  })
})
