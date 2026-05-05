/**
 * Modelo de datos normalizado que produce el parser y consume el motor de reglas IRPF.
 *
 * Principios:
 * - **Neutro respecto al broker**: no debe contener campos específicos de IBKR.
 * - **Neutro respecto al ejercicio fiscal**: no habla de casillas de Renta Web, ni
 *   de convenios, ni aplica FIFO. Eso es trabajo del motor de reglas (año-específico).
 * - **Trazable**: cada evento conserva su `provenance` para auditoría línea-a-línea.
 * - **Múltiples divisas**: cada importe (`Money`) lleva su equivalente en EUR
 *   calculado al tipo de cambio del día del evento (no cierre de año).
 */

// ============================================================================
// Tipos primitivos
// ============================================================================

/** Año natural del ejercicio fiscal (2024, 2025, …). */
export type TaxYear = number

/** Código ISO 4217 de divisa (EUR, USD, GBP…). */
export type CurrencyCode = string

/** Código ISO 3166-1 alpha-2 de país (ES, US, GB, DE, FR, NL…). */
export type CountryCode = string

/** Fecha en formato ISO `YYYY-MM-DD`. */
export type IsoDate = string

/**
 * Importe en su divisa original con equivalente en euros.
 *
 * Para divisa EUR: `fxRate` = 1 y `fxDate` = `date` del evento. Se mantienen
 * poblados para que el código consumidor no tenga que hacer null-checks.
 */
export interface Money {
  /** Importe en la divisa original. */
  amount: number
  /** Divisa original. */
  currency: CurrencyCode
  /** Equivalente en euros al tipo de cambio del día del evento. */
  eur: number
  /** Tipo de cambio aplicado (1 unidad de `currency` → EUR). */
  fxRate: number
  /** Fecha del tipo de cambio. Normalmente coincide con la fecha del evento. */
  fxDate: IsoDate
}

/** Identificación del instrumento financiero. */
export interface Instrument {
  /** Ticker/símbolo como aparece en el extracto ("ENG", "CMG"…). */
  symbol: string
  /** ISIN si el extracto lo proporciona. Los dos primeros caracteres indican país. */
  isin?: string
  /** Nombre descriptivo ("Enagás SA", "Clipper Realty Inc"…). */
  name?: string
  /** Clase de activo. */
  assetClass: 'STK' | 'ETF' | 'BOND' | 'FUND' | 'OTHER'
  /**
   * País del emisor. Determina el país de retención en origen para dividendos.
   * Inferido del ISIN cuando esté disponible; si no, de otras pistas del extracto.
   */
  countryOfIssuer?: CountryCode
}

/** Procedencia del evento en el extracto original (auditabilidad). */
export interface Provenance {
  /** Formato del extracto del que se extrajo. */
  source: 'ibkr-csv' | 'ibkr-html'
  /** Sección del extracto ("Dividends", "Withholding Tax", "Trades"…). */
  section: string
  /** Número de fila dentro de la sección (0-indexed). */
  rowIndex: number
  /** Fila cruda tal como aparece en el extracto, para inspección. */
  raw: Record<string, string>
}

// ============================================================================
// Eventos
// ============================================================================

interface BaseEvent {
  /** Identificador interno único (uuid). */
  id: string
  /** Fecha contable del evento (fecha de cobro para dividendos e intereses). */
  date: IsoDate
  provenance: Provenance
}

/** Dividendo bruto cobrado. */
export interface DividendEvent extends BaseEvent {
  kind: 'dividend'
  instrument: Instrument
  /** Importe bruto antes de retenciones. */
  gross: Money
  /** País que aplica la retención en origen (suele coincidir con el del emisor). */
  countryOfSource: CountryCode
  /**
   * Subtipo fiscal:
   * - `cash`: dividendo ordinario en efectivo.
   * - `stock`: scrip dividend (cobrado en acciones).
   * - `payment-in-lieu`: pago sustitutorio por préstamo de acciones. NO es
   *   dividendo en sentido estricto; el motor de reglas puede decidir
   *   tratamiento distinto.
   * - `drip`: dividendo reinvertido. Tributa igualmente como bruto.
   * - `return-of-capital`: reduce coste de adquisición, no tributa como
   *   rendimiento del capital mobiliario.
   */
  subtype: 'cash' | 'stock' | 'payment-in-lieu' | 'drip' | 'return-of-capital'
  /** Link al `WithholdingEvent` asociado (si lo hay). */
  withholdingId?: string
}

/** Retención practicada sobre un rendimiento (dividendo, intereses, cupón). */
export interface WithholdingEvent extends BaseEvent {
  kind: 'withholding'
  instrument?: Instrument
  /** Importe retenido (siempre positivo). */
  amount: Money
  /** País que practicó la retención. */
  countryOfTax: CountryCode
  /**
   * - `foreign-source`: retención en origen (doble imposición internacional).
   * - `spanish`: retención practicada en España (casilla "Retenciones").
   */
  scope: 'foreign-source' | 'spanish'
  relatesTo: 'dividend' | 'interest' | 'coupon'
  /** Link al `DividendEvent`/`InterestEvent` asociado. */
  incomeEventId?: string
}

/** Reembolso parcial de retención (withholding refund / reversal). */
export interface WithholdingRefundEvent extends BaseEvent {
  kind: 'withholding-refund'
  instrument?: Instrument
  /** Importe reembolsado (positivo). El motor lo netea contra retenciones. */
  amount: Money
  countryOfTax: CountryCode
  /** Link al `WithholdingEvent` original cuando sea identificable. */
  originalWithholdingId?: string
}

/** Intereses cobrados (cuenta remunerada, márgen, cupón de bono…). */
export interface InterestEvent extends BaseEvent {
  kind: 'interest'
  gross: Money
  source: 'cash-account' | 'margin' | 'bond-coupon' | 'other'
  /** Solo si es cupón de un bono. */
  instrument?: Instrument
  countryOfSource?: CountryCode
  withholdingId?: string
}

/** Compra o venta de un instrumento. */
export interface TradeEvent extends BaseEvent {
  kind: 'trade'
  instrument: Instrument
  side: 'buy' | 'sell'
  /** Cantidad siempre positiva; `side` indica la dirección. */
  quantity: number
  pricePerUnit: Money
  /** `quantity * pricePerUnit`. */
  gross: Money
  /** Comisión de la operación (positivo = coste). */
  commission: Money
  /** Importe efectivamente movido (neto de comisiones). */
  net: Money
  settlementDate?: IsoDate
}

/** Comisiones/fees sin contrapartida directa en trade (ADR fees, custodia…). */
export interface FeeEvent extends BaseEvent {
  kind: 'fee'
  instrument?: Instrument
  /** Importe (negativo = coste). */
  amount: Money
  feeType: 'adr-fee' | 'custody' | 'financing' | 'other'
}

/** Conversión explícita de divisa ejecutada por el broker. */
export interface FxConversionEvent extends BaseEvent {
  kind: 'fx-conversion'
  from: Money
  to: Money
}

/** Movimiento de caja (depósito, retirada, ajuste…). No tributa por sí solo. */
export interface CashTransactionEvent extends BaseEvent {
  kind: 'cash-transaction'
  amount: Money
  txType: 'deposit' | 'withdrawal' | 'internal-transfer' | 'adjustment' | 'other'
  description?: string
}

/** Unión discriminada de todos los eventos. */
export type StatementEvent =
  | DividendEvent
  | WithholdingEvent
  | WithholdingRefundEvent
  | InterestEvent
  | TradeEvent
  | FeeEvent
  | FxConversionEvent
  | CashTransactionEvent

// ============================================================================
// Documento completo (salida del parser)
// ============================================================================

/** Datos de la cuenta extraídos del extracto. */
export interface AccountInfo {
  /** Identificador de cuenta. Redactado por defecto ("U…567"). */
  accountId?: string
  /** Divisa base de la cuenta. */
  baseCurrency: CurrencyCode
  periodFrom: IsoDate
  periodTo: IsoDate
  broker: 'IBKR'
}

/** Aviso o incidencia detectada durante el parseo. */
export interface ParserWarning {
  severity: 'info' | 'warn' | 'error'
  /**
   * Código canónico de la incidencia. Estable entre versiones para que la UI
   * pueda mapear códigos a mensajes localizados.
   *
   * Ejemplos: `fx-rate-missing`, `unpaired-withholding`, `unknown-section`,
   * `amount-mismatch`, `unsupported-asset-class`, `withholding-exceeds-treaty`.
   */
  code: string
  message: string
  /** Evento afectado, si aplica. */
  eventId?: string
}

/**
 * Totales agregados que la fuente original reporta (o que derivamos de sus
 * eventos). Usados por el merger para validar cruzadamente cuando hay varias
 * fuentes del mismo período.
 */
export interface SourceTotals {
  /** Suma de dividendos brutos en EUR (incluye ROC si la fuente lo incluye). */
  dividendGrossEur?: number
  /** Número de dividendos detectados. Puede variar entre fuentes (ROC split, etc.). */
  dividendCount?: number
  /** Suma de retenciones en EUR, en valor absoluto. */
  withholdingEur?: number
  withholdingCount?: number
}

/** Documento normalizado completo — contrato estable parser → reglas → UI. */
export interface StatementDocument {
  accountInfo: AccountInfo
  /** Ejercicio fiscal al que pertenece el extracto. */
  taxYear: TaxYear
  events: StatementEvent[]
  warnings: ParserWarning[]
  /** Timestamp ISO de cuándo se parseó. */
  parsedAt: string
  /** Versión semver del parser (para reproducibilidad). */
  parserVersion: string
  /** Totales que la fuente reporta; útiles para cross-validation. */
  sourceTotals?: SourceTotals
}

/**
 * Versión del **modelo de datos del parser** (este archivo + los parsers IBKR).
 * Subirla cuando cambien los tipos de eventos o `StatementDocument`.
 *
 * **Independiente** de la versión del producto en `package.json`: aquella se
 * mueve por ciclos de release; ésta solo cuando un consumidor del documento
 * (motor de reglas, import/export JSON) tendría que adaptarse.
 */
export const PARSER_VERSION = '0.1.0'
