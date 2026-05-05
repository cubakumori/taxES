/**
 * Exports CSV de sesión: resumen por país y dividendos detalle línea a línea.
 *
 * Pensados para abrir en Excel / Google Sheets / Numbers y usarse como hoja de
 * trabajo al presentar la declaración (o para contrastar con el asesor).
 *
 * NOTA: no se incluye un export de "todos los eventos" porque el JSON ya hace
 * ese rol para uso programático. El CSV aporta valor cuando la granularidad
 * tiene una lectura fiscal clara (por país, por dividendo).
 */

import type { DividendEvent, StatementDocument } from '../parser/types'
import { getCountryName } from '../rules/country-names'
import type {
  IrpfGainLossRow,
  IrpfGainLossSummary,
  IrpfSummary,
} from '../rules/types'
import { type CsvColumn, formatNumberCsv, toCsv } from './csv'

/** Resumen por país: una fila por país con totales, convenio, deducible y excedente. */
export function buildSummaryByCountryCsv(summary: IrpfSummary): string {
  interface Row {
    country: string
    countryName: string
    dividendCount: number
    grossEur: number
    withheldEur: number
    treatyRatePct: number
    hasTreaty: boolean
    withholdingCapEur: number
    deductibleEur: number
    excessEur: number
  }

  const rows: Row[] = summary.dobleImposicionInternacional.porPais.map((p) => ({
    country: p.country,
    countryName: getCountryName(p.country),
    dividendCount: p.dividendCount,
    grossEur: p.grossEur,
    withheldEur: p.withheldEur,
    treatyRatePct: p.treatyRate * 100,
    hasTreaty: p.hasTreaty,
    withholdingCapEur: p.withholdingCapEur,
    deductibleEur: p.deductibleEur,
    excessEur: p.excessEur,
  }))

  rows.sort((a, b) => b.grossEur - a.grossEur)

  const columns: CsvColumn<Row>[] = [
    { key: 'country', label: 'Código país' },
    { key: 'countryName', label: 'País' },
    { key: 'dividendCount', label: 'Nº dividendos' },
    { key: 'grossEur', label: 'Bruto EUR', format: (v) => formatNumberCsv(v as number) },
    { key: 'withheldEur', label: 'Retenido EUR', format: (v) => formatNumberCsv(v as number) },
    {
      key: 'hasTreaty',
      label: 'Convenio',
      format: (_v, r) => (r.hasTreaty ? `${formatNumberCsv(r.treatyRatePct, 1)} %` : 'sin convenio'),
    },
    {
      key: 'withholdingCapEur',
      label: 'Cap convenio EUR',
      format: (v) => formatNumberCsv(v as number),
    },
    { key: 'deductibleEur', label: 'Deducible EUR', format: (v) => formatNumberCsv(v as number) },
    {
      key: 'excessEur',
      label: 'Excedente no recuperable EUR',
      format: (v) => formatNumberCsv(v as number),
    },
  ]

  return toCsv(rows, columns)
}

/** Dividendos detalle: una fila por cada DividendEvent del documento. */
export function buildDividendsDetailCsv(doc: StatementDocument): string {
  interface Row {
    date: string
    symbol: string
    isin: string
    name: string
    country: string
    countryName: string
    subtype: string
    currency: string
    amountOriginal: number
    fxRate: number
    grossEur: number
  }

  const dividends = doc.events.filter(
    (e): e is DividendEvent => e.kind === 'dividend',
  )

  const rows: Row[] = dividends.map((d) => ({
    date: d.date,
    symbol: d.instrument.symbol,
    isin: d.instrument.isin ?? '',
    name: d.instrument.name ?? '',
    country: d.countryOfSource,
    countryName: getCountryName(d.countryOfSource),
    subtype: d.subtype,
    currency: d.gross.currency,
    amountOriginal: d.gross.amount,
    fxRate: d.gross.fxRate,
    grossEur: d.gross.eur,
  }))

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))

  const columns: CsvColumn<Row>[] = [
    { key: 'date', label: 'Fecha' },
    { key: 'symbol', label: 'Símbolo' },
    { key: 'isin', label: 'ISIN' },
    { key: 'name', label: 'Nombre' },
    { key: 'country', label: 'País' },
    { key: 'countryName', label: 'País (nombre)' },
    { key: 'subtype', label: 'Subtipo' },
    { key: 'currency', label: 'Divisa' },
    {
      key: 'amountOriginal',
      label: 'Importe',
      format: (v) => formatNumberCsv(v as number),
    },
    {
      key: 'fxRate',
      label: 'Tipo de cambio',
      format: (v) => formatNumberCsv(v as number, 6),
    },
    { key: 'grossEur', label: 'Bruto EUR', format: (v) => formatNumberCsv(v as number) },
  ]

  return toCsv(rows, columns)
}

/** Plusvalías FIFO: una fila por venta del ejercicio con su base de coste y resultado. */
export function buildPlusvaliasCsv(plusvalias: IrpfGainLossSummary): string {
  const rows: IrpfGainLossRow[] = [...plusvalias.rows]
  rows.sort(
    (a, b) =>
      a.saleDate.localeCompare(b.saleDate) ||
      a.symbol.localeCompare(b.symbol),
  )

  const columns: CsvColumn<IrpfGainLossRow>[] = [
    { key: 'saleDate', label: 'Fecha venta' },
    { key: 'symbol', label: 'Símbolo' },
    { key: 'isin', label: 'ISIN' },
    { key: 'name', label: 'Nombre' },
    {
      key: 'countryOfIssuer',
      label: 'País emisor',
      format: (v) => (v ? `${v} · ${getCountryName(v as string)}` : ''),
    },
    {
      key: 'quantity',
      label: 'Cantidad',
      format: (v) => formatNumberCsv(v as number, 4),
    },
    { key: 'acquisitionFrom', label: 'Adquisición desde' },
    { key: 'acquisitionTo', label: 'Adquisición hasta' },
    {
      key: 'saleProceedsEur',
      label: 'Valor transmisión EUR',
      format: (v) => formatNumberCsv(v as number),
    },
    {
      key: 'acquisitionCostEur',
      label: 'Valor adquisición EUR',
      format: (v) => formatNumberCsv(v as number),
    },
    {
      key: 'gainLossEur',
      label: 'Resultado EUR',
      format: (v) => formatNumberCsv(v as number),
    },
    {
      key: 'hasIncompleteBasis',
      label: 'Base incompleta',
      format: (v) => (v ? 'sí' : ''),
    },
    {
      key: 'antiElusionFlag',
      label: 'Anti-elusión',
      format: (v) => (v ? 'sí' : ''),
    },
  ]

  return toCsv(rows, columns)
}
