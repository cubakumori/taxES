import { describe, expect, it } from 'vitest'
import { DIVIDEND_REPORT_BASIC_2025 } from '../__fixtures__'
import { parseIbkrDividendReport } from '../parser/ibkr/dividend-report'
import { computeIbkrEquivalence } from './ibkr-equivalence'

describe('computeIbkrEquivalence', () => {
  it('calcula Total Ordinary Dividends (cash, todos los años)', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const eq = computeIbkrEquivalence(doc)
    // cash: ENG 30.40 + MO 10.80 + UCB 40.00 + APLE-cash 3.60 = 84.80
    expect(eq.totalOrdinaryDividends).toBeCloseTo(84.8, 2)
  })

  it('calcula Total non-US Ordinary Dividends', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const eq = computeIbkrEquivalence(doc)
    // non-US cash: ENG 30.40 + UCB 40.00 = 70.40
    expect(eq.totalNonUsOrdinaryDividends).toBeCloseTo(70.4, 2)
  })

  it('calcula US Tax Paid separado de Non-US', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const eq = computeIbkrEquivalence(doc)
    // US: MO 1.62 + APLE 0.64 = 2.26
    expect(eq.usTaxPaid).toBeCloseTo(2.26, 2)
    // Non-US: ES 5.78 + BE 12.00 = 17.78
    expect(eq.nonUsTaxPaid).toBeCloseTo(17.78, 2)
  })

  it('calcula Return of Capital (incluyendo APLE parcial + N2IU completo)', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const eq = computeIbkrEquivalence(doc)
    // ROC: APLE 1.15 + N2IU 34.00 = 35.15
    expect(eq.returnOfCapital).toBeCloseTo(35.15, 2)
  })
})
