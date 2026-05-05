/**
 * Merger de fuentes IBKR: combina el `DividendReport.csv` (autoritativo para
 * dividendos y retenciones) y el `Informe de Actividad.csv` (autoritativo para
 * trades, fees y movimientos de caja) en un único `StatementDocument`.
 *
 * Además emite un `CrossValidationReport` que compara los totales reportados
 * por cada fuente y avisa de discrepancias.
 */

import type {
  Instrument,
  StatementDocument,
  StatementEvent,
} from './types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SourceType = 'dividend-report' | 'activity-statement'

export interface MergedSource {
  type: SourceType
  parserVersion: string
  parsedAt: string
}

/** Comparación de un total entre dos fuentes. */
export interface ValidationMetric {
  dividendReport?: number
  activityStatement?: number
  diff: number
  match: boolean
}

export interface CrossValidationReport {
  /** Valor absoluto máximo de diferencia tolerada (EUR). */
  threshold: number
  dividendGrossEur: ValidationMetric
  withholdingEur: ValidationMetric
  dividendCount: ValidationMetric
  overallMatch: boolean
  /** Si alguna fuente falta, la validación no se puede hacer. */
  available: boolean
}

export interface MergedStatementDocument extends StatementDocument {
  sources: MergedSource[]
  crossValidation?: CrossValidationReport
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const THRESHOLD_EUR = 0.05 // 5 céntimos
const COUNT_THRESHOLD = 5 // tolerancia de ± eventos (ROC split puede aumentar el count)

function toSource(doc: StatementDocument, type: SourceType): MergedSource {
  return { type, parserVersion: doc.parserVersion, parsedAt: doc.parsedAt }
}

function enrichInstrument(
  inst: Instrument,
  catalog: Map<string, Instrument>,
): Instrument {
  const fromCatalog = catalog.get(inst.symbol)
  if (!fromCatalog) return inst
  return {
    ...inst,
    isin: inst.isin ?? fromCatalog.isin,
    name: inst.name ?? fromCatalog.name,
    countryOfIssuer: inst.countryOfIssuer ?? fromCatalog.countryOfIssuer,
  }
}

function buildInstrumentCatalog(doc: StatementDocument): Map<string, Instrument> {
  const catalog = new Map<string, Instrument>()
  for (const ev of doc.events) {
    if ('instrument' in ev && ev.instrument) {
      const existing = catalog.get(ev.instrument.symbol)
      if (!existing) {
        catalog.set(ev.instrument.symbol, ev.instrument)
      } else {
        // Combina si algo falta.
        catalog.set(ev.instrument.symbol, {
          ...existing,
          isin: existing.isin ?? ev.instrument.isin,
          name: existing.name ?? ev.instrument.name,
          countryOfIssuer:
            existing.countryOfIssuer ?? ev.instrument.countryOfIssuer,
        })
      }
    }
  }
  return catalog
}

function enrichEventInstruments(
  events: StatementEvent[],
  catalog: Map<string, Instrument>,
): StatementEvent[] {
  return events.map((ev) => {
    if (!('instrument' in ev) || !ev.instrument) return ev
    return { ...ev, instrument: enrichInstrument(ev.instrument, catalog) } as StatementEvent
  })
}

// ---------------------------------------------------------------------------
// Cross-validation
// ---------------------------------------------------------------------------

function buildValidation(
  dividendDoc: StatementDocument | null,
  activityDoc: StatementDocument | null,
): CrossValidationReport | undefined {
  if (!dividendDoc || !activityDoc) return undefined
  const dt = dividendDoc.sourceTotals
  const at = activityDoc.sourceTotals
  if (!dt || !at) return undefined

  const compareAmount = (a?: number, b?: number): ValidationMetric => {
    const diff = (a ?? 0) - (b ?? 0)
    return {
      dividendReport: a,
      activityStatement: b,
      diff,
      match: Math.abs(diff) <= THRESHOLD_EUR,
    }
  }
  const compareCount = (a?: number, b?: number): ValidationMetric => {
    const diff = (a ?? 0) - (b ?? 0)
    return {
      dividendReport: a,
      activityStatement: b,
      diff,
      match: Math.abs(diff) <= COUNT_THRESHOLD,
    }
  }

  const dividendGrossEur = compareAmount(dt.dividendGrossEur, at.dividendGrossEur)
  const withholdingEur = compareAmount(dt.withholdingEur, at.withholdingEur)
  const dividendCount = compareCount(dt.dividendCount, at.dividendCount)

  return {
    threshold: THRESHOLD_EUR,
    available: true,
    dividendGrossEur,
    withholdingEur,
    dividendCount,
    overallMatch: dividendGrossEur.match && withholdingEur.match,
  }
}

// ---------------------------------------------------------------------------
// Merger principal
// ---------------------------------------------------------------------------

export function mergeIbkrStatements(
  dividendDoc: StatementDocument | null,
  activityDoc: StatementDocument | null,
): MergedStatementDocument | null {
  if (!dividendDoc && !activityDoc) return null

  // Caso: solo una fuente — envoltorio mínimo.
  if (!activityDoc && dividendDoc) {
    return {
      ...dividendDoc,
      sources: [toSource(dividendDoc, 'dividend-report')],
    }
  }
  if (!dividendDoc && activityDoc) {
    return {
      ...activityDoc,
      sources: [toSource(activityDoc, 'activity-statement')],
    }
  }

  // Ambas presentes: merge real.
  // TypeScript ya sabe que ambos son no-null aquí.
  const div = dividendDoc!
  const act = activityDoc!

  // Catálogo de instrumentos desde AMBAS fuentes (AS suele tener ISIN y nombre).
  const catalog = new Map<string, Instrument>()
  for (const [sym, inst] of buildInstrumentCatalog(act)) catalog.set(sym, inst)
  // DivReport puede aportar country-of-source desde descripciones (menos completo, pero lo tomamos en cuenta).
  for (const [sym, inst] of buildInstrumentCatalog(div)) {
    const existing = catalog.get(sym)
    if (!existing) catalog.set(sym, inst)
  }

  // Eventos:
  // - Dividendos y retenciones: SOLO del DividendReport (es la fuente fiscal canónica)
  // - Trades, fees, cash, fx, fee-refund: del Activity Statement
  // - El Activity Statement NO emite dividendos (decisión del parser), así que no hay duplicados.
  const divEvents = div.events
  const actEvents = act.events.filter(
    (e) =>
      e.kind !== 'dividend' &&
      e.kind !== 'withholding' &&
      e.kind !== 'withholding-refund',
  )

  const allEvents = [...divEvents, ...actEvents].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const enrichedEvents = enrichEventInstruments(allEvents, catalog)

  // AccountInfo: preferir la del Activity Statement porque suele tener el
  // período explícito desde la sección `Statement`.
  const accountInfo = {
    ...div.accountInfo,
    ...act.accountInfo,
    // Preserva accountId redactado si el otro no lo tiene.
    accountId: act.accountInfo.accountId ?? div.accountInfo.accountId,
  }

  // Warnings combinados + deduplicación suave (misma code + message).
  const combinedWarnings = [...div.warnings, ...act.warnings]
  const seen = new Set<string>()
  const warnings = combinedWarnings.filter((w) => {
    const key = `${w.code}::${w.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Año fiscal: preferir el del DividendReport (tiene lógica de moda/caja).
  const taxYear = div.taxYear

  const crossValidation = buildValidation(div, act)

  return {
    accountInfo,
    taxYear,
    events: enrichedEvents,
    warnings,
    parsedAt: new Date().toISOString(),
    parserVersion: div.parserVersion,
    sourceTotals: div.sourceTotals, // mantenemos los del DividendReport como referencia IRPF
    sources: [
      toSource(div, 'dividend-report'),
      toSource(act, 'activity-statement'),
    ],
    crossValidation,
  }
}
