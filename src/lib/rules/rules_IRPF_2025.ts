/**
 * Motor de reglas IRPF para el ejercicio 2025.
 *
 * Convierte un `StatementDocument` normalizado en un `IrpfSummary` listo para
 * volcar en Renta Web:
 * - **Casilla 0029** (rendimientos del capital mobiliario, base del ahorro):
 *   suma de dividendos brutos tributables + retenciones practicadas en España.
 * - **Deducción por doble imposición internacional** (base del ahorro):
 *   rendimientos brutos del extranjero + impuesto satisfecho en el extranjero
 *   respetando el límite máximo del convenio con cada país.
 *
 * Lo que SE EXCLUYE del tributable:
 * - Dividendos con `subtype: 'return-of-capital'` (no tributan; reducen coste).
 * - Eventos con fecha fuera del año fiscal predominante (criterio de caja).
 */

import type {
  DividendEvent,
  StatementDocument,
  WithholdingEvent,
} from '../parser/types'
import { computeFifoGains } from './fifo'
import type {
  IrpfCasillaDividendos,
  IrpfCountrySummary,
  IrpfDoubleTaxationDeduction,
  IrpfNotice,
  IrpfSummary,
} from './types'
import { getTreatyInfo } from './treaty-rates'

export const RULES_VERSION = 'IRPF_2025_v0.2.0'

export interface Irpf2025Options {
  /**
   * Otros extractos del MISMO `accountId` con ejercicios anteriores al
   * declarable. Se usan únicamente para construir la cola FIFO de lotes
   * abiertos (no tributan sus eventos: solo aportan base de coste).
   */
  priorDocs?: readonly StatementDocument[]
}

export function applyRulesIrpf2025(
  doc: StatementDocument,
  options: Irpf2025Options = {},
): IrpfSummary {
  const taxYear = doc.taxYear

  const inYear = <T extends { date: string }>(e: T): boolean =>
    Number.parseInt(e.date.slice(0, 4), 10) === taxYear

  // Particionado en una sola pasada: dividendos cash tributables del ejercicio,
  // retenciones del ejercicio y cuenta de eventos de renta (div/ret/int/refund)
  // que caen fuera del ejercicio (= "eventsExcluded" de IrpfPeriod).
  const dividends: DividendEvent[] = []
  const withholdings: WithholdingEvent[] = []
  let eventsExcluded = 0

  for (const e of doc.events) {
    const isIncomeEvent =
      e.kind === 'dividend' ||
      e.kind === 'withholding' ||
      e.kind === 'withholding-refund' ||
      e.kind === 'interest'
    if (isIncomeEvent && !inYear(e)) {
      eventsExcluded += 1
      continue
    }
    if (e.kind === 'dividend' && e.subtype === 'cash' && inYear(e)) {
      dividends.push(e)
    } else if (e.kind === 'withholding' && inYear(e)) {
      withholdings.push(e)
    }
  }

  const avisos: IrpfNotice[] = []

  // --- Casilla 0029 ---
  const ingresosIntegros = dividends.reduce((s, d) => s + d.gross.eur, 0)
  const retencionesEspaña = withholdings
    .filter((w) => w.scope === 'spanish')
    .reduce((s, w) => s + w.amount.eur, 0)

  const casillaDividendos: IrpfCasillaDividendos = {
    casilla: '0029',
    label: 'Dividendos y demás rendimientos por la participación en fondos propios de entidades',
    ingresosIntegros,
    retenciones: retencionesEspaña,
  }

  // --- Doble imposición internacional (solo extranjeros) ---
  const foreignDividends = dividends.filter((d) => d.countryOfSource !== 'ES')
  const foreignWithholdings = withholdings.filter((w) => w.scope === 'foreign-source')

  // Agregado por país.
  type CountryAgg = { count: number; gross: number; withheld: number }
  const byCountry = new Map<string, CountryAgg>()

  for (const d of foreignDividends) {
    const a = byCountry.get(d.countryOfSource) ?? { count: 0, gross: 0, withheld: 0 }
    a.count += 1
    a.gross += d.gross.eur
    byCountry.set(d.countryOfSource, a)
  }
  for (const w of foreignWithholdings) {
    const a = byCountry.get(w.countryOfTax) ?? { count: 0, gross: 0, withheld: 0 }
    a.withheld += w.amount.eur
    byCountry.set(w.countryOfTax, a)
  }

  const porPais: IrpfCountrySummary[] = []
  let totalDeducible = 0
  let totalExcedente = 0

  for (const [country, agg] of byCountry) {
    const treaty = getTreatyInfo(country)
    const capEur = agg.gross * treaty.rate
    const deductibleEur = Math.min(agg.withheld, capEur)
    const excessEur = Math.max(0, agg.withheld - deductibleEur)

    porPais.push({
      country,
      dividendCount: agg.count,
      grossEur: agg.gross,
      withheldEur: agg.withheld,
      treatyRate: treaty.rate,
      withholdingCapEur: capEur,
      deductibleEur,
      excessEur,
      hasTreaty: treaty.hasTreaty,
      treatySource: treaty.source,
      treatyNote: treaty.note,
    })

    totalDeducible += deductibleEur
    totalExcedente += excessEur

    if (!treaty.hasTreaty && agg.withheld > 0.01) {
      avisos.push({
        severity: 'error',
        code: 'no-treaty-withholding',
        message: `${country}: sin convenio de doble imposición con España. Retención de ${agg.withheld.toFixed(2)} € NO es recuperable vía IRPF.`,
        anchorCountry: country,
      })
    } else if (excessEur > 0.01) {
      const appliedPct = (agg.withheld / agg.gross) * 100
      const capPct = treaty.rate * 100
      avisos.push({
        severity: 'warn',
        code: 'withholding-exceeds-treaty',
        message: `${country}: retención aplicada ${appliedPct.toFixed(1)} % (${agg.withheld.toFixed(2)} €) excede el límite del convenio ${capPct.toFixed(0)} % (${capEur.toFixed(2)} €). Excedente no recuperable vía IRPF: ${excessEur.toFixed(2)} €. Reclamación posible al broker o país de origen.`,
        anchorCountry: country,
      })
    }

    if (treaty.note) {
      avisos.push({
        severity: 'info',
        code: 'treaty-note',
        message: `${country} — ${treaty.note}`,
        anchorCountry: country,
      })
    }
  }

  porPais.sort((a, b) => a.country.localeCompare(b.country))

  const dobleImposicionInternacional: IrpfDoubleTaxationDeduction = {
    rendimientosEur: foreignDividends.reduce((s, d) => s + d.gross.eur, 0),
    impuestoSatisfechoEur: totalDeducible,
    impuestoExcedenteEur: totalExcedente,
    porPais,
  }

  // Período del resumen.
  const allDates = [...dividends, ...withholdings].map((e) => e.date).sort()
  const period = {
    taxYear,
    from: allDates[0] ?? `${taxYear}-01-01`,
    to: allDates[allDates.length - 1] ?? `${taxYear}-12-31`,
    eventsExcluded,
  }

  // Propagar avisos relevantes del parser.
  for (const w of doc.warnings) {
    if (w.code === 'event-outside-tax-year') {
      avisos.push({
        severity: 'info',
        code: 'parser-' + w.code,
        message: w.message,
      })
    }
  }

  // --- Plusvalías FIFO ---
  const priorDocs = options.priorDocs ?? []
  const fifoDocs = [...priorDocs, doc]
  const fifoResult = computeFifoGains(fifoDocs, taxYear)
  const plusvalias =
    fifoResult.summary.rows.length > 0 ? fifoResult.summary : undefined
  if (plusvalias) {
    for (const n of fifoResult.notices) {
      avisos.push({
        severity: n.severity,
        code: n.code,
        message: n.message,
      })
    }
  }

  return {
    taxYear,
    accountId: doc.accountInfo.accountId,
    baseCurrency: doc.accountInfo.baseCurrency,
    period,
    casillaDividendos,
    dobleImposicionInternacional,
    plusvalias,
    avisos,
    generadoEl: new Date().toISOString(),
    motorReglasVersion: RULES_VERSION,
    parserVersion: doc.parserVersion,
  }
}
