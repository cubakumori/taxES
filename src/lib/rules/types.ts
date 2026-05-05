/**
 * Tipos de salida del motor de reglas IRPF. Describen el "resumen Renta Web":
 * qué poner en cada casilla, qué ir a cada apartado de deducciones, qué avisos
 * levantar.
 *
 * Versionados por ejercicio para aislar cambios normativos. La misma estructura
 * debe valer para `rules_IRPF_2025`, `rules_IRPF_2026`, etc.
 */

import type { IsoDate, CountryCode } from '../parser/types'

/**
 * Rendimientos del capital mobiliario integrables en la base del ahorro,
 * bloque "Dividendos y demás rendimientos por la participación en fondos propios".
 * Renta Web — casilla 0029 (ejercicio 2025).
 */
export interface IrpfCasillaDividendos {
  casilla: '0029'
  label: string
  /** Suma de todos los dividendos brutos tributables (EUR), español y extranjero. */
  ingresosIntegros: number
  /** SOLO retenciones practicadas en España. Las extranjeras NO van aquí. */
  retenciones: number
}

/** Fila por país en la deducción por doble imposición internacional. */
export interface IrpfCountrySummary {
  country: CountryCode
  dividendCount: number
  /** Bruto tributable de dividendos de este país (EUR). */
  grossEur: number
  /** Retención realmente practicada (EUR). */
  withheldEur: number
  /** Tipo del convenio de doble imposición (0.15 = 15 %). 0 si no hay convenio. */
  treatyRate: number
  /** Límite máximo deducible según convenio = grossEur × treatyRate. */
  withholdingCapEur: number
  /** Importe deducible = min(withheldEur, withholdingCapEur). */
  deductibleEur: number
  /** Excedente no recuperable vía IRPF = withheldEur − deductibleEur. */
  excessEur: number
  hasTreaty: boolean
  treatySource?: string
  treatyNote?: string
}

/**
 * Deducción por doble imposición internacional, rentas incluidas en la base
 * del ahorro (bloque "rendimientos netos reducidos del capital mobiliario
 * obtenidos en el extranjero").
 */
export interface IrpfDoubleTaxationDeduction {
  /** Suma de dividendos brutos extranjeros (≠ ES) tributables en EUR. */
  rendimientosEur: number
  /** Suma de deducibles aplicados tras límite de convenio por país. */
  impuestoSatisfechoEur: number
  /** Suma de excedentes no recuperables. */
  impuestoExcedenteEur: number
  porPais: IrpfCountrySummary[]
}

/** Aviso generado por el motor de reglas durante el cálculo. */
export interface IrpfNotice {
  severity: 'info' | 'warn' | 'error'
  code: string
  message: string
  /** Código de país al que se ancla el aviso (permite enlazarlo con su fila en la tabla por país). */
  anchorCountry?: CountryCode
}

/** Snapshot del rango temporal que cubre el resumen. */
export interface IrpfPeriod {
  taxYear: number
  from: IsoDate
  to: IsoDate
  /** Eventos excluidos por caer fuera del ejercicio fiscal. */
  eventsExcluded: number
}

/**
 * Una venta con su base de coste FIFO matcheada. Equivale a una fila del
 * apartado "Ganancias y pérdidas patrimoniales derivadas de la transmisión de
 * valores negociados".
 */
export interface IrpfGainLossRow {
  saleDate: IsoDate
  symbol: string
  isin?: string
  name?: string
  countryOfIssuer?: CountryCode
  quantity: number
  /** Valor de transmisión = proceeds brutos − comisiones de venta (EUR). */
  saleProceedsEur: number
  /** Valor de adquisición = suma coste FIFO consumido + comisiones de compra − ROC acumulado (EUR). */
  acquisitionCostEur: number
  /** Ganancia (positiva) o pérdida (negativa) patrimonial en EUR. */
  gainLossEur: number
  /** Rango de fechas de los lotes FIFO consumidos (solo informativo). */
  acquisitionFrom?: IsoDate
  acquisitionTo?: IsoDate
  /**
   * `true` si al consumir lotes no había buy previo suficiente: el coste
   * faltante se toma como 0. Indicador de que el usuario debe completar
   * cost basis manualmente (compras anteriores a los extractos cargados).
   */
  hasIncompleteBasis: boolean
  /**
   * `true` si el motor detecta un posible supuesto de regla anti-elusión
   * (2 meses mercado español / 1 año extranjero): pérdida realizada con compra
   * del mismo ISIN en ventana cercana. Solo aviso; el motor NO difiere la
   * pérdida automáticamente.
   */
  antiElusionFlag: boolean
}

/** Resumen de plusvalías/minusvalías por transmisión de valores. */
export interface IrpfGainLossSummary {
  label: string
  /** Nota sobre qué casilla(s) concretas usar en Renta Web del ejercicio. */
  casillaNote: string
  totalValorTransmisionEur: number
  totalValorAdquisicionEur: number
  /** Suma de ganancias positivas. */
  totalGananciasEur: number
  /** Suma absoluta de pérdidas. */
  totalPerdidasEur: number
  /** Neto = ganancias − pérdidas. */
  netoEur: number
  rows: IrpfGainLossRow[]
}

/** Resumen IRPF completo — salida del motor de reglas. */
export interface IrpfSummary {
  taxYear: number
  accountId?: string
  baseCurrency: string
  period: IrpfPeriod
  casillaDividendos: IrpfCasillaDividendos
  dobleImposicionInternacional: IrpfDoubleTaxationDeduction
  /**
   * Plusvalías/minusvalías FIFO. `undefined` si no hubo ventas en el ejercicio.
   */
  plusvalias?: IrpfGainLossSummary
  avisos: IrpfNotice[]
  generadoEl: string
  motorReglasVersion: string
  parserVersion: string
}
