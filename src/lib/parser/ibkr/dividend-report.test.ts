import { describe, expect, it } from 'vitest'
import {
  DIVIDEND_REPORT_BASIC_2025,
  DIVIDEND_REPORT_OUT_OF_YEAR,
} from '../../__fixtures__'
import type { DividendEvent, WithholdingEvent } from '../types'
import { parseIbkrDividendReport } from './dividend-report'

describe('parseIbkrDividendReport', () => {
  it('extrae la info de cuenta y redacta el accountId', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    expect(doc.accountInfo.baseCurrency).toBe('EUR')
    expect(doc.accountInfo.accountId).toBe('U…234')
    expect(doc.accountInfo.broker).toBe('IBKR')
  })

  it('detecta el ejercicio fiscal como moda de años', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    expect(doc.taxYear).toBe(2025)
  })

  it('divide los dividendos con ROC parcial en dos eventos', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const aple = doc.events.filter(
      (e): e is DividendEvent =>
        e.kind === 'dividend' && e.instrument.symbol === 'APLE',
    )
    expect(aple).toHaveLength(2)
    const cash = aple.find((e) => e.subtype === 'cash')
    const roc = aple.find((e) => e.subtype === 'return-of-capital')
    expect(cash?.gross.eur).toBeCloseTo(3.6, 2)
    expect(roc?.gross.eur).toBeCloseTo(1.15, 2)
  })

  it('marca dividendos 100 % ROC con subtype return-of-capital', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const n2iu = doc.events.filter(
      (e): e is DividendEvent =>
        e.kind === 'dividend' && e.instrument.symbol === 'N2IU',
    )
    expect(n2iu).toHaveLength(1)
    expect(n2iu[0].subtype).toBe('return-of-capital')
    expect(n2iu[0].gross.eur).toBeCloseTo(34.0, 2)
  })

  it('distingue retenciones españolas (scope=spanish) de extranjeras', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const whs = doc.events.filter(
      (e): e is WithholdingEvent => e.kind === 'withholding',
    )
    const spanish = whs.filter((w) => w.scope === 'spanish')
    const foreign = whs.filter((w) => w.scope === 'foreign-source')
    expect(spanish).toHaveLength(1)
    expect(spanish[0].countryOfTax).toBe('ES')
    expect(foreign.map((w) => w.countryOfTax).sort()).toEqual(['BE', 'US', 'US'])
  })

  it('empareja dividendos y retenciones vía withholdingId', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const eng = doc.events.find(
      (e): e is DividendEvent =>
        e.kind === 'dividend' && e.instrument.symbol === 'ENG',
    )
    expect(eng?.withholdingId).toBeTruthy()
    const paired = doc.events.find(
      (e): e is WithholdingEvent =>
        e.kind === 'withholding' && e.id === eng?.withholdingId,
    )
    expect(paired?.amount.eur).toBeCloseTo(5.78, 2)
  })

  it('calcula sourceTotals coherentes con los eventos', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const divs = doc.events.filter(
      (e): e is DividendEvent => e.kind === 'dividend',
    )
    const whs = doc.events.filter(
      (e): e is WithholdingEvent => e.kind === 'withholding',
    )
    expect(doc.sourceTotals?.dividendGrossEur).toBeCloseTo(
      divs.reduce((s, d) => s + d.gross.eur, 0),
      2,
    )
    expect(doc.sourceTotals?.withholdingEur).toBeCloseTo(
      whs.reduce((s, w) => s + w.amount.eur, 0),
      2,
    )
  })

  it('cuadra al céntimo con los totales esperados del fixture', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    // Total bruto = 30.40 + 10.80 + 40.00 + 4.75 + 34.00 = 119.95
    expect(doc.sourceTotals?.dividendGrossEur).toBeCloseTo(119.95, 2)
    // Total retenciones = 5.78 + 1.62 + 12.00 + 0.64 = 20.04
    expect(doc.sourceTotals?.withholdingEur).toBeCloseTo(20.04, 2)
  })

  it('emite warning event-outside-tax-year para eventos fuera del ejercicio predominante', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_OUT_OF_YEAR)
    // 2 eventos 2025 (ENG + RC), 2 eventos 2026 (ENG + RC). Moda sigue siendo 2025 por empate roto por orden de inserción.
    // Pero lo importante: debe detectar los 2026.
    const outOfYear = doc.warnings.filter(
      (w) => w.code === 'event-outside-tax-year',
    )
    expect(outOfYear.length).toBeGreaterThan(0)
  })

  it('lanza si falta la sección Account', () => {
    const bad = `Foo,Header,a\nFoo,Data,b\n`
    expect(() => parseIbkrDividendReport(bad)).toThrow(/Account/)
  })
})
