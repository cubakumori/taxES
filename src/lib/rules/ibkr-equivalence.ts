/**
 * Vista "IBKR-equivalent": reproduce los totales tal como los calcula el
 * bloque "Dividend Revenue Summary" del `DividendReport.html` oficial (ejes
 * US / Non-US, sin filtro de año fiscal). Sirve para que el usuario pueda
 * contrastar al céntimo su extracto con lo que calcula la app.
 *
 * NO es una vista fiscal: para el IRPF español usar `applyRulesIrpf2025`.
 */

import type {
  DividendEvent,
  StatementDocument,
  TaxYear,
  WithholdingEvent,
} from '../parser/types'

export interface IbkrEquivalenceView {
  /** Suma de dividendos tributables (cash-subtype) en EUR, TODO el extracto. */
  totalOrdinaryDividends: number
  /** Dividendos tributables con `countryOfSource !== 'US'`. */
  totalNonUsOrdinaryDividends: number
  /** Retenciones donde `countryOfTax === 'US'`. */
  usTaxPaid: number
  /** Retenciones de todos los demás países (incluye España). */
  nonUsTaxPaid: number
  /** Suma de dividendos con subtipo `return-of-capital`. No tributa. */
  returnOfCapital: number

  /** Dividendos tributables con fecha fuera del ejercicio `taxYear`. */
  excludedOutOfYearDividendGross: number
  /** Retenciones US excluidas por caer fuera del ejercicio. */
  excludedOutOfYearUsTaxPaid: number
  /** Retenciones no-US excluidas por caer fuera del ejercicio. */
  excludedOutOfYearNonUsTaxPaid: number
}

export function computeIbkrEquivalence(
  doc: StatementDocument,
  taxYear: TaxYear = doc.taxYear,
): IbkrEquivalenceView {
  const dividends = doc.events.filter(
    (e): e is DividendEvent => e.kind === 'dividend',
  )
  const withholdings = doc.events.filter(
    (e): e is WithholdingEvent => e.kind === 'withholding',
  )
  const yearOf = (date: string): number => Number.parseInt(date.slice(0, 4), 10)

  const cashAll = dividends.filter((d) => d.subtype === 'cash')
  const rocAll = dividends.filter((d) => d.subtype === 'return-of-capital')

  const totalOrdinaryDividends = cashAll.reduce((s, d) => s + d.gross.eur, 0)
  const totalNonUsOrdinaryDividends = cashAll
    .filter((d) => d.countryOfSource !== 'US')
    .reduce((s, d) => s + d.gross.eur, 0)

  const usTaxPaid = withholdings
    .filter((w) => w.countryOfTax === 'US')
    .reduce((s, w) => s + w.amount.eur, 0)
  const nonUsTaxPaid = withholdings
    .filter((w) => w.countryOfTax !== 'US')
    .reduce((s, w) => s + w.amount.eur, 0)

  const returnOfCapital = rocAll.reduce((s, d) => s + d.gross.eur, 0)

  const excludedOutOfYearDividendGross = cashAll
    .filter((d) => yearOf(d.date) !== taxYear)
    .reduce((s, d) => s + d.gross.eur, 0)
  const excludedOutOfYearUsTaxPaid = withholdings
    .filter((w) => w.countryOfTax === 'US' && yearOf(w.date) !== taxYear)
    .reduce((s, w) => s + w.amount.eur, 0)
  const excludedOutOfYearNonUsTaxPaid = withholdings
    .filter((w) => w.countryOfTax !== 'US' && yearOf(w.date) !== taxYear)
    .reduce((s, w) => s + w.amount.eur, 0)

  return {
    totalOrdinaryDividends,
    totalNonUsOrdinaryDividends,
    usTaxPaid,
    nonUsTaxPaid,
    returnOfCapital,
    excludedOutOfYearDividendGross,
    excludedOutOfYearUsTaxPaid,
    excludedOutOfYearNonUsTaxPaid,
  }
}
