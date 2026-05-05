/**
 * Parser del `DividendReport.csv` de Interactive Brokers.
 *
 * Este archivo es un informe fiscal específico que agrupa dividendos y
 * retenciones en la misma línea, con país de origen explícito y el equivalente
 * en la divisa base (EUR) ya calculado por IBKR.
 *
 * Estructura del CSV (orden SECUENCIAL, no agrupado por clave):
 * - Sección `Account`: datos de la cuenta (ID, divisa base, titular).
 * - Sección `DividendDetail`: filas `Summary` seguidas inmediatamente por las
 *   filas `RevenueComponent` que la desglosan. Dos dividendos distintos pueden
 *   compartir símbolo+divisa+fecha (IBKR los separa cuando hay componentes de
 *   naturaleza fiscal distinta). Por eso el parser recorre la sección
 *   secuencialmente, no indexa por clave.
 *
 * Subtypes según `RevenueComponent`:
 * - `Ordinary Dividend`, `Franking Dividend`, `Exempt From Withholding` → `cash`
 *   (tributan como rendimiento del capital mobiliario).
 * - `Return of Capital` → `return-of-capital` (no tributa; reduce coste de
 *   adquisición). Si un dividendo lo tiene parcialmente, se EMITE COMO DOS
 *   `DividendEvent` separados (uno `cash` por la parte no-ROC, otro
 *   `return-of-capital` por la parte ROC).
 * - `Other` → componente sin bruto, normalmente ajustes pequeños de retención
 *   que ya van reflejados en `Summary.Withhold`.
 */

import {
  type AccountInfo,
  type DividendEvent,
  type Instrument,
  type Money,
  PARSER_VERSION,
  type ParserWarning,
  type Provenance,
  type StatementDocument,
  type StatementEvent,
  type WithholdingEvent,
} from '../types'
import { type CsvRow, groupBySection, parseCsv, rowToRecord } from './csv'
import { normalizeIbkrDate, num, redactAccountId, uuid } from './utils'

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------

function fxRateFrom(amountOriginal: number, amountBase: number): number {
  if (amountOriginal === 0) return 1
  return amountBase / amountOriginal
}

/** Valores de `RevenueComponent` que cuentan como dividendo tributable. */
const TAXABLE_COMPONENTS = new Set([
  'Ordinary Dividend',
  'Franking Dividend',
  'Exempt From Withholding',
])

/** Agrupación de una Summary + sus RevenueComponent contiguos en el CSV. */
interface DividendGroup {
  summary: Record<string, string>
  summaryRowIndex: number
  components: Record<string, string>[]
}

/** Recorre la sección secuencialmente y agrupa cada Summary con sus componentes. */
function collectDividendGroups(
  rows: CsvRow[],
  header: string[],
): DividendGroup[] {
  const groups: DividendGroup[] = []
  let current: DividendGroup | null = null

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row[1] !== 'Data') continue
    const rec = rowToRecord(row, header)

    if (rec.DataDiscriminator === 'Summary') {
      current = { summary: rec, summaryRowIndex: i, components: [] }
      groups.push(current)
    } else if (rec.DataDiscriminator === 'RevenueComponent' && current) {
      current.components.push(rec)
    }
    // 'Total' y otros se ignoran.
  }

  return groups
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export function parseIbkrDividendReport(csvText: string): StatementDocument {
  const rows = parseCsv(csvText)
  const sections = groupBySection(rows)
  const warnings: ParserWarning[] = []
  const events: StatementEvent[] = []

  // --- Sección Account ---
  const accountSection = sections.get('Account')
  if (!accountSection?.header) {
    throw new Error('DividendReport.csv: falta la sección Account o su Header')
  }
  const accountDataRow = accountSection.rows.find((r) => r[1] === 'Data')
  if (!accountDataRow) {
    throw new Error('DividendReport.csv: no hay fila Account,Data')
  }
  const acc = rowToRecord(accountDataRow, accountSection.header)

  const accountInfo: AccountInfo = {
    accountId: acc.AccountNumber ? redactAccountId(acc.AccountNumber) : undefined,
    baseCurrency: acc.BaseCurrency || 'EUR',
    periodFrom: '',
    periodTo: '',
    broker: 'IBKR',
  }

  // --- Sección DividendDetail ---
  const dividendSection = sections.get('DividendDetail')
  if (!dividendSection?.header) {
    throw new Error('DividendReport.csv: falta la sección DividendDetail o su Header')
  }

  const groups = collectDividendGroups(dividendSection.rows, dividendSection.header)

  for (const group of groups) {
    const { summary, summaryRowIndex, components } = group

    const date = normalizeIbkrDate(summary.ReportDate)
    const symbol = summary.Symbol
    const currency = summary.Currency

    const instrument: Instrument = {
      symbol,
      assetClass: 'STK',
      countryOfIssuer: summary.Country || undefined,
    }

    const provenance: Provenance = {
      source: 'ibkr-csv',
      section: 'DividendDetail',
      rowIndex: summaryRowIndex,
      raw: summary,
    }

    const totalGrossOrig = num(summary.Gross)
    const totalGrossEur = num(summary.GrossInBase)
    const totalWithholdOrig = num(summary.Withhold) // ya negativo si hay retención
    const totalWithholdEur = num(summary.WithholdInBase)

    // Calcular la porción ROC (si la hay) a partir de los componentes.
    let rocOrig = 0
    for (const comp of components) {
      if (comp.RevenueComponent === 'Return of Capital') {
        rocOrig += num(comp.Gross)
      }
    }
    // Equivalente en EUR proporcional al bruto original.
    const rocEur = totalGrossOrig !== 0 ? (rocOrig / totalGrossOrig) * totalGrossEur : 0
    const taxableOrig = totalGrossOrig - rocOrig
    const taxableEur = totalGrossEur - rocEur

    // Caso 1: 100 % ROC → un solo DividendEvent con subtype return-of-capital.
    if (rocOrig !== 0 && Math.abs(rocOrig - totalGrossOrig) < 0.005) {
      const gross: Money = {
        amount: rocOrig,
        currency,
        eur: rocEur,
        fxRate: fxRateFrom(rocOrig, rocEur),
        fxDate: date,
      }
      events.push({
        id: uuid(),
        kind: 'dividend',
        date,
        provenance,
        instrument,
        gross,
        countryOfSource: summary.Country || 'XX',
        subtype: 'return-of-capital',
      })
      continue
    }

    // Caso 2: 0 % ROC → un solo DividendEvent cash.
    // Caso 3: ROC parcial → emitimos DOS DividendEvent (cash + return-of-capital).
    const dividendId = uuid()

    // Parte tributable (cash)
    const cashGross: Money = {
      amount: taxableOrig,
      currency,
      eur: taxableEur,
      fxRate: fxRateFrom(taxableOrig, taxableEur),
      fxDate: date,
    }

    const cashDividend: DividendEvent = {
      id: dividendId,
      kind: 'dividend',
      date,
      provenance,
      instrument,
      gross: cashGross,
      countryOfSource: summary.Country || 'XX',
      subtype: 'cash',
    }
    events.push(cashDividend)

    // Parte ROC (si hay)
    if (rocOrig !== 0) {
      const rocGrossMoney: Money = {
        amount: rocOrig,
        currency,
        eur: rocEur,
        fxRate: fxRateFrom(rocOrig, rocEur),
        fxDate: date,
      }
      events.push({
        id: uuid(),
        kind: 'dividend',
        date,
        provenance,
        instrument,
        gross: rocGrossMoney,
        countryOfSource: summary.Country || 'XX',
        subtype: 'return-of-capital',
      })
      warnings.push({
        severity: 'info',
        code: 'split-roc-component',
        message: `Dividendo ${symbol} ${date} dividido en parte tributable (${taxableEur.toFixed(2)} EUR) y Return of Capital (${rocEur.toFixed(2)} EUR). La parte ROC reduce coste de adquisición, no tributa como rendimiento.`,
        eventId: dividendId,
      })
    }

    // Retención (siempre asociada al evento cash cuando existe)
    if (totalWithholdOrig !== 0) {
      const whAmount: Money = {
        amount: Math.abs(totalWithholdOrig),
        currency,
        eur: Math.abs(totalWithholdEur),
        fxRate: fxRateFrom(totalWithholdOrig, totalWithholdEur),
        fxDate: date,
      }
      const whId = uuid()
      const withholding: WithholdingEvent = {
        id: whId,
        kind: 'withholding',
        date,
        provenance,
        instrument,
        amount: whAmount,
        countryOfTax: summary.Country || 'XX',
        scope: summary.Country === 'ES' ? 'spanish' : 'foreign-source',
        relatesTo: 'dividend',
        incomeEventId: dividendId,
      }
      cashDividend.withholdingId = whId
      events.push(withholding)
    }

    // Validación: componentes tributables conocidos.
    const unknownComponents = components.filter(
      (c) =>
        c.RevenueComponent &&
        c.RevenueComponent !== 'Return of Capital' &&
        c.RevenueComponent !== 'Other' &&
        !TAXABLE_COMPONENTS.has(c.RevenueComponent),
    )
    for (const comp of unknownComponents) {
      warnings.push({
        severity: 'warn',
        code: 'unknown-revenue-component',
        message: `Componente de dividendo no reconocido: "${comp.RevenueComponent}" en ${symbol} ${date}. Se trata como tributable por defecto; revisar si corresponde.`,
        eventId: dividendId,
      })
    }
  }

  // Orden cronológico.
  events.sort((a, b) => a.date.localeCompare(b.date))

  // Período: fechas min/max de eventos.
  if (events.length > 0) {
    accountInfo.periodFrom = events[0].date
    accountInfo.periodTo = events[events.length - 1].date
  }

  // Ejercicio fiscal = moda de los años de los eventos.
  const yearCounts = new Map<number, number>()
  for (const ev of events) {
    const y = Number.parseInt(ev.date.slice(0, 4), 10)
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1)
  }
  const taxYear =
    [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    new Date().getFullYear()

  // Avisar de eventos fuera del año fiscal predominante (criterio de caja AEAT).
  for (const ev of events) {
    const y = Number.parseInt(ev.date.slice(0, 4), 10)
    if (y !== taxYear) {
      warnings.push({
        severity: 'info',
        code: 'event-outside-tax-year',
        message: `Evento de ${ev.date} (año ${y}) detectado en un informe del ejercicio ${taxYear}. Por criterio de caja se declara en el IRPF del año de cobro (${y}), no en el del ejercicio del informe.`,
        eventId: ev.id,
      })
    }
  }

  // Totales desde los eventos (para cross-validation con otras fuentes).
  const divs = events.filter((e) => e.kind === 'dividend')
  const whs = events.filter((e) => e.kind === 'withholding')
  const sourceTotals = {
    dividendGrossEur: divs.reduce((s, d) => s + (d as { gross: { eur: number } }).gross.eur, 0),
    dividendCount: divs.length,
    withholdingEur: whs.reduce((s, w) => s + (w as { amount: { eur: number } }).amount.eur, 0),
    withholdingCount: whs.length,
  }

  return {
    accountInfo,
    taxYear,
    events,
    warnings,
    parsedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    sourceTotals,
  }
}
