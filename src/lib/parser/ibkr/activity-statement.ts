/**
 * Parser del `Informe de Actividad.csv` de Interactive Brokers.
 *
 * Complementa al parser del `DividendReport.csv`: ese informe cubre dividendos
 * y retenciones al detalle fiscal; este informe añade operaciones (trades),
 * comisiones/tarifas, movimientos de caja y un catálogo de instrumentos con
 * ISIN.
 *
 * Secciones que extrae:
 * - **Información sobre la cuenta** → `AccountInfo` (pares clave/valor).
 * - **Statement** → período del informe.
 * - **Información de instrumento financiero** → catálogo `Símbolo → ISIN`.
 * - **Operaciones** (Categoría = Acciones / ETF) → `TradeEvent`.
 * - **Tarifas** → `FeeEvent` con clasificación heurística (custody / adr-fee / other).
 * - **Depósitos y retiradas** → `CashTransactionEvent`.
 *
 * **Fuera de alcance por ahora** (se emite warning con contadores):
 * - Operaciones de **Fórex** (la mayoría, conversiones automáticas de IBKR).
 * - Secciones `Dividendos` / `Retención de impuestos` (usar `DividendReport.csv`).
 * - Acciones corporativas, Modificación en dividendos devengados, Posiciones.
 *
 * El resultado es un `StatementDocument` parcial cuyos eventos no incluyen
 * dividendos: la fusión con el `DividendReport.csv` la hará el merger en un
 * paso posterior.
 */

import { getBceRateToEur, isBceSupported } from '../../fx/bce'
import {
  type AccountInfo,
  type CashTransactionEvent,
  type CountryCode,
  type FeeEvent,
  type FxConversionEvent,
  type Instrument,
  type Money,
  PARSER_VERSION,
  type ParserWarning,
  type Provenance,
  type SourceTotals,
  type StatementDocument,
  type StatementEvent,
  type TradeEvent,
} from '../types'
import {
  type CsvRow,
  type CsvSection,
  groupBySection,
  parseCsv,
  rowToRecord,
} from './csv'
import { normalizeIbkrDate, num, redactAccountId, uuid } from './utils'

// ---------------------------------------------------------------------------
// Helpers locales
// ---------------------------------------------------------------------------

/** "APLE(US03784Y2000)" → { symbol: "APLE", isin: "US03784Y2000" } */
function parseSymbolWithIsin(raw: string): { symbol: string; isin?: string } {
  const m = raw.match(/^([^(]+)\(([A-Z]{2}[A-Z0-9]{9}[0-9])\)$/)
  if (m) return { symbol: m[1].trim(), isin: m[2] }
  return { symbol: raw.trim() }
}

/** Los dos primeros caracteres de un ISIN son código de país ISO. */
function countryFromIsin(isin: string | undefined): CountryCode | undefined {
  if (!isin || isin.length < 2) return undefined
  return isin.slice(0, 2)
}

/**
 * Construye un `Money` resolviendo el tipo de cambio a EUR contra el histórico
 * del BCE. Si la divisa no está soportada o la fecha está fuera de rango,
 * deja `eur = 0`, `fxRate = 0` y contabiliza el fallo en `missingByCurrency`
 * para emitir un único warning agregado al final del parseo.
 */
function makeMoney(
  amount: number,
  currency: string,
  date: string,
  missingByCurrency: Map<string, number>,
): Money {
  if (amount === 0 || currency === 'EUR') {
    return { amount, currency, eur: amount, fxRate: 1, fxDate: date }
  }
  const lookup = getBceRateToEur(currency, date)
  if (lookup) {
    return {
      amount,
      currency,
      eur: amount * lookup.rate,
      fxRate: lookup.rate,
      fxDate: lookup.fxDate,
    }
  }
  missingByCurrency.set(currency, (missingByCurrency.get(currency) ?? 0) + 1)
  return { amount, currency, eur: 0, fxRate: 0, fxDate: date }
}

function emitFxWarnings(
  warnings: ParserWarning[],
  missingByCurrency: Map<string, number>,
): void {
  for (const [currency, count] of missingByCurrency) {
    if (isBceSupported(currency)) {
      warnings.push({
        severity: 'info',
        code: 'fx-rate-missing',
        message: `${currency}: ${count} evento(s) sin tipo BCE resoluble (fecha fuera del histórico bundleado o hueco puntual). El importe en EUR queda en 0.`,
      })
    } else {
      warnings.push({
        severity: 'warn',
        code: 'fx-currency-unsupported',
        message: `${currency}: divisa no publicada por el BCE (${count} evento(s) afectado(s)). Los importes en EUR no se calculan automáticamente; revisar manualmente con el tipo del broker.`,
      })
    }
  }
}

/** Clasifica una descripción de tarifa en un `feeType`. */
function classifyFee(description: string): FeeEvent['feeType'] {
  const d = description.toLowerCase()
  if (d.includes('custod')) return 'custody'
  if (d.includes('adr')) return 'adr-fee'
  if (d.includes('financ') || d.includes('interés') || d.includes('interest')) {
    return 'financing'
  }
  return 'other'
}

/** Dado un objeto { key: row[2], value: row[3] } toma lista de rows de key-value sections. */
function pickKeyValue(rows: CsvRow[], key: string): string | undefined {
  for (const r of rows) {
    if (r[1] === 'Data' && r[2] === key) return r[3]
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Sub-parsers
// ---------------------------------------------------------------------------

function parseAccountInfo(
  sections: Map<string, CsvSection>,
): { accountInfo: AccountInfo; period: { from: string; to: string } } {
  const accSec = sections.get('Información sobre la cuenta')
  const stmtSec = sections.get('Statement')

  const accountNumber = accSec ? pickKeyValue(accSec.rows, 'Cuenta') : undefined
  const baseCurrency = (accSec ? pickKeyValue(accSec.rows, 'Divisa base') : undefined) ?? 'EUR'

  // Period viene en Statement como "Enero 1, 2025 - Diciembre 31, 2025".
  let from = ''
  let to = ''
  if (stmtSec) {
    const periodRaw = pickKeyValue(stmtSec.rows, 'Period')
    if (periodRaw) {
      const yearMatch = periodRaw.match(/(\d{4})/g)
      if (yearMatch && yearMatch.length >= 1) {
        const y1 = yearMatch[0]
        const y2 = yearMatch[yearMatch.length - 1]
        from = `${y1}-01-01`
        to = `${y2}-12-31`
      }
    }
  }

  const accountInfo: AccountInfo = {
    accountId: accountNumber ? redactAccountId(accountNumber) : undefined,
    baseCurrency,
    periodFrom: from,
    periodTo: to,
    broker: 'IBKR',
  }
  return { accountInfo, period: { from, to } }
}

/** Construye un mapa `Símbolo → Instrument` desde la sección de instrumentos. */
function buildInstrumentCatalog(
  sections: Map<string, CsvSection>,
): Map<string, Instrument> {
  const catalog = new Map<string, Instrument>()
  const section = sections.get('Información de instrumento financiero')
  if (!section?.header) return catalog

  for (const row of section.rows) {
    if (row[1] !== 'Data') continue
    const rec = rowToRecord(row, section.header)
    const symbol = rec['Símbolo']
    if (!symbol) continue

    const isin = rec['Id. de seguridad'] || undefined
    const category = rec['Categoría de activo'] || ''
    const instrument: Instrument = {
      symbol,
      isin,
      name: rec['Descripción'] || undefined,
      assetClass:
        category === 'Acciones'
          ? 'STK'
          : category === 'ETF'
            ? 'ETF'
            : category === 'Bono'
              ? 'BOND'
              : category === 'Fondos'
                ? 'FUND'
                : 'OTHER',
      countryOfIssuer: countryFromIsin(isin),
    }
    catalog.set(symbol, instrument)
  }

  return catalog
}

function parseTrades(
  sections: Map<string, CsvSection>,
  catalog: Map<string, Instrument>,
  warnings: ParserWarning[],
  missingByCurrency: Map<string, number>,
): { trades: TradeEvent[]; fxSkipped: number; fxEvents: FxConversionEvent[] } {
  const trades: TradeEvent[] = []
  const fxEvents: FxConversionEvent[] = []
  let fxSkipped = 0

  const section = sections.get('Operaciones')
  if (!section?.header) return { trades, fxSkipped, fxEvents }

  for (let i = 0; i < section.rows.length; i++) {
    const row = section.rows[i]
    if (row[1] !== 'Data') continue
    const rec = rowToRecord(row, section.header)
    if (rec.DataDiscriminator !== 'Order') continue

    const category = rec['Categoría de activo'] || ''
    const currency = rec.Divisa || ''
    const dateRaw = rec['Fecha/Hora'] || ''
    const date = normalizeIbkrDate(dateRaw)
    const quantityRaw = num(rec.Cantidad)
    const price = num(rec['Precio trans.'])
    const productos = num(rec.Productos) // signed: < 0 = buy, > 0 = sell
    const commission = num(rec['Tarifa/com.'])
    const basico = num(rec['Básico'])
    const code = rec['Código'] || ''

    const provenance: Provenance = {
      source: 'ibkr-csv',
      section: 'Operaciones',
      rowIndex: i,
      raw: rec,
    }

    if (category === 'Fórex') {
      // Fórex simplificado: registrar como FxConversionEvent con datos mínimos.
      // La parte "from" y "to" se puede derivar del símbolo (p. ej. EUR.USD)
      // pero no es crítico para IRPF. De momento, contamos y emitimos mínimo.
      fxSkipped += 1
      continue
    }

    if (category !== 'Acciones' && category !== 'ETF' && category !== 'Fondos') {
      warnings.push({
        severity: 'warn',
        code: 'unsupported-asset-class',
        message: `Operación con categoría no soportada: "${category}" (${rec['Símbolo']} ${date}). Se ignora.`,
      })
      continue
    }

    // Determinación de side: BUY/SELL explícito en Código prevalece;
    // si no, signo de Productos (< 0 = compra, > 0 = venta).
    let side: 'buy' | 'sell'
    if (/\bBUY\b/i.test(code)) side = 'buy'
    else if (/\bSELL\b/i.test(code)) side = 'sell'
    else side = productos < 0 ? 'buy' : 'sell'

    // Símbolo: puede ser "XXX" o "XXX(ISIN)".
    const parsedSym = parseSymbolWithIsin(rec['Símbolo'] || '')
    const base: Instrument = catalog.get(parsedSym.symbol) ?? {
      symbol: parsedSym.symbol,
      assetClass: category === 'Acciones' ? 'STK' : category === 'ETF' ? 'ETF' : 'FUND',
    }
    const instrument: Instrument = {
      ...base,
      isin: base.isin ?? parsedSym.isin,
      countryOfIssuer: base.countryOfIssuer ?? countryFromIsin(parsedSym.isin ?? base.isin),
    }

    const pricePerUnit = makeMoney(price, currency, date, missingByCurrency)
    const gross = makeMoney(
      Math.abs(productos),
      currency,
      date,
      missingByCurrency,
    )
    const commissionMoney = makeMoney(
      Math.abs(commission),
      currency,
      date,
      missingByCurrency,
    )
    const net = makeMoney(Math.abs(basico), currency, date, missingByCurrency)

    trades.push({
      id: uuid(),
      kind: 'trade',
      date,
      provenance,
      instrument,
      side,
      quantity: Math.abs(quantityRaw),
      pricePerUnit,
      gross,
      commission: commissionMoney,
      net,
    })
  }

  if (fxSkipped > 0) {
    warnings.push({
      severity: 'info',
      code: 'forex-skipped',
      message: `${fxSkipped} operaciones de Fórex detectadas y no procesadas (conversiones automáticas de IBKR). Fuera de alcance del MVP.`,
    })
  }

  return { trades, fxSkipped, fxEvents }
}

function parseFees(
  sections: Map<string, CsvSection>,
  catalog: Map<string, Instrument>,
  warnings: ParserWarning[],
  missingByCurrency: Map<string, number>,
): FeeEvent[] {
  const events: FeeEvent[] = []
  const section = sections.get('Tarifas')
  if (!section?.header) return events

  for (let i = 0; i < section.rows.length; i++) {
    const row = section.rows[i]
    if (row[1] !== 'Data') continue
    const rec = rowToRecord(row, section.header)

    const currency = rec.Divisa || ''
    const dateRaw = rec.Fecha || ''
    const date = normalizeIbkrDate(dateRaw)
    const description = rec['Descripción'] || ''
    const amount = num(rec.Cantidad) // negativo = coste

    if (!date || !currency) continue

    const feeType = classifyFee(description)

    // Intentar inferir instrumento asociado leyendo la descripción
    // ("Custodian Safekeeping Fee for XYZ" o "XYZ Comisión ADR", etc.).
    let instrument: Instrument | undefined
    for (const sym of catalog.keys()) {
      if (description.includes(sym)) {
        instrument = catalog.get(sym)
        break
      }
    }

    const money = makeMoney(amount, currency, date, missingByCurrency)

    events.push({
      id: uuid(),
      kind: 'fee',
      date,
      provenance: {
        source: 'ibkr-csv',
        section: 'Tarifas',
        rowIndex: i,
        raw: rec,
      },
      instrument,
      amount: money,
      feeType,
    })
  }

  return events
}

/**
 * Extrae los totales que el propio Informe de Actividad calcula para
 * Dividendos y Retención de impuestos. Usados para cross-validation con el
 * DividendReport.csv sin tener que parsear cada fila fiscalmente.
 */
function extractSourceTotals(sections: Map<string, CsvSection>): SourceTotals {
  const totals: SourceTotals = {}

  const divSec = sections.get('Dividendos')
  if (divSec) {
    for (const row of divSec.rows) {
      if (row[2] === 'Total Dividendos en EUR') {
        const last = row.filter((c) => c !== '').pop()
        if (last) totals.dividendGrossEur = num(last)
        break
      }
    }
    // Conteo: filas Data cuya col[3] parece un código de divisa (3 letras mayúsculas).
    const currencyRe = /^[A-Z]{3}$/
    totals.dividendCount = divSec.rows.filter(
      (r) => r[1] === 'Data' && currencyRe.test(r[3] ?? ''),
    ).length
  }

  const whSec = sections.get('Retención de impuestos')
  if (whSec) {
    for (const row of whSec.rows) {
      if (row[2] === 'Total Retención de impuestos en EUR') {
        const last = row.filter((c) => c !== '').pop()
        if (last) totals.withholdingEur = Math.abs(num(last))
        break
      }
    }
    const currencyRe = /^[A-Z]{3}$/
    totals.withholdingCount = whSec.rows.filter(
      (r) => r[1] === 'Data' && currencyRe.test(r[3] ?? ''),
    ).length
  }

  return totals
}

function parseCashTransactions(
  sections: Map<string, CsvSection>,
  warnings: ParserWarning[],
  missingByCurrency: Map<string, number>,
): CashTransactionEvent[] {
  const events: CashTransactionEvent[] = []
  const section = sections.get('Depósitos y retiradas')
  if (!section?.header) return events

  for (let i = 0; i < section.rows.length; i++) {
    const row = section.rows[i]
    if (row[1] !== 'Data') continue
    const rec = rowToRecord(row, section.header)

    const currency = rec.Divisa || ''
    const dateRaw = rec['Fecha de liquidación'] || rec.Fecha || ''
    const date = normalizeIbkrDate(dateRaw)
    const description = rec['Descripción'] || ''
    const amount = num(rec.Cantidad)

    if (!date || !currency) continue

    // Clasificación por signo y descripción.
    const d = description.toLowerCase()
    let txType: CashTransactionEvent['txType'] = 'other'
    if (d.includes('transferencia') || d.includes('deposit')) {
      txType = amount >= 0 ? 'deposit' : 'withdrawal'
    } else if (amount > 0) txType = 'deposit'
    else if (amount < 0) txType = 'withdrawal'

    const money = makeMoney(amount, currency, date, missingByCurrency)

    events.push({
      id: uuid(),
      kind: 'cash-transaction',
      date,
      provenance: {
        source: 'ibkr-csv',
        section: 'Depósitos y retiradas',
        rowIndex: i,
        raw: rec,
      },
      amount: money,
      txType,
      description: description || undefined,
    })
  }

  return events
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------

export function parseIbkrActivityStatement(csvText: string): StatementDocument {
  const rows = parseCsv(csvText)
  const sections = groupBySection(rows)
  const warnings: ParserWarning[] = []

  const { accountInfo, period } = parseAccountInfo(sections)
  const catalog = buildInstrumentCatalog(sections)
  const missingByCurrency = new Map<string, number>()

  const { trades, fxSkipped } = parseTrades(
    sections,
    catalog,
    warnings,
    missingByCurrency,
  )
  void fxSkipped
  const fees = parseFees(sections, catalog, warnings, missingByCurrency)
  const cashTxs = parseCashTransactions(
    sections,
    warnings,
    missingByCurrency,
  )
  emitFxWarnings(warnings, missingByCurrency)

  const events: StatementEvent[] = [...trades, ...fees, ...cashTxs].sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  // Si el período no se extrajo del Statement, inferirlo de los eventos.
  if ((!accountInfo.periodFrom || !accountInfo.periodTo) && events.length > 0) {
    const dates = events.map((e) => e.date).sort()
    accountInfo.periodFrom = accountInfo.periodFrom || dates[0]
    accountInfo.periodTo = accountInfo.periodTo || dates[dates.length - 1]
  }

  // Año fiscal = año de `periodFrom` (IBKR genera un extracto por año natural).
  const taxYear = accountInfo.periodFrom
    ? Number.parseInt(accountInfo.periodFrom.slice(0, 4), 10)
    : new Date().getFullYear()

  void period

  const sourceTotals = extractSourceTotals(sections)

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
