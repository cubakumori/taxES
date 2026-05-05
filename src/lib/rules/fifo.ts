/**
 * Motor FIFO de plusvalías y minusvalías patrimoniales para la base del ahorro
 * del IRPF. Cubre la transmisión de valores negociados (acciones y ETFs).
 *
 * Criterio fiscal aplicado:
 * - **FIFO por ISIN** (art. 37.2 LIRPF): se consideran vendidas primero las
 *   más antiguas. Agregamos todos los extractos IBKR del usuario (mismo
 *   `accountId`) para construir el histórico de lotes; las ventas del ejercicio
 *   reportado consumen de ese histórico en orden cronológico.
 * - **Valor de adquisición** = precio de compra + comisión de compra,
 *   prorrateado por acción al calcular el consumo de un lote.
 * - **Valor de transmisión** = precio de venta − comisión de venta.
 * - **Return of Capital**: reduce el valor de adquisición prorrateando la
 *   devolución entre los lotes abiertos de ese ISIN proporcionalmente a las
 *   acciones remanentes. Si no hay lotes abiertos se ignora (el fiscal estricto
 *   pediría afectar al siguiente buy, caso raro).
 *
 * Fuera de alcance v1 (solo aviso, sin ajuste automático):
 * - **Regla anti-elusión 2m/1a** (art. 33.5.f LIRPF): pérdida + recompra en
 *   ventana corta → la pérdida se difiere. Detectamos el patrón y flagueamos
 *   la fila para revisión del usuario, pero NO posponemos el importe.
 * - **Acciones corporativas** (splits, spinoffs, fusiones): cambian qty y base
 *   de coste. Fuera de alcance v1; el motor avisa al usuario si detecta ROC
 *   (muchas CAs vienen acompañadas de ajustes ROC).
 *
 * Datos faltantes (`hasIncompleteBasis`): si una venta consume más acciones
 * de las registradas en los extractos cargados, usamos 0 como coste faltante y
 * flagueamos la fila. El usuario debería cargar extractos anteriores o entrar
 * cost basis manualmente.
 */

import type {
  DividendEvent,
  Instrument,
  IsoDate,
  ParserWarning,
  StatementDocument,
  TradeEvent,
} from '../parser/types'
import type { IrpfGainLossRow, IrpfGainLossSummary } from './types'

export const FIFO_ENGINE_VERSION = 'FIFO_v0.1.0'

/** Lote abierto en la cola FIFO de un ISIN. */
interface Lot {
  date: IsoDate
  quantityRemaining: number
  /** Coste prorrateado por acción, en EUR. Puede reducirse por ROC posterior. */
  costPerUnitEur: number
}

/** Evento ordenable: trades y ROC dividends. */
type FifoEvent =
  | { kind: 'buy' | 'sell'; trade: TradeEvent }
  | { kind: 'roc'; dividend: DividendEvent }

interface InstrumentSlot {
  instrument: Instrument
  lots: Lot[]
  buyDates: IsoDate[] // para detectar anti-elusión sin recorrer lots
}

function instrumentKey(inst: Instrument): string {
  return inst.isin ?? `SYM:${inst.symbol}`
}

/** Cota para el aviso anti-elusión (ISO "YYYY-MM-DD"). */
function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map((s) => Number.parseInt(s, 10))
  const dt = new Date(Date.UTC(y, m - 1 + months, d))
  return dt.toISOString().slice(0, 10)
}

function addYears(date: IsoDate, years: number): IsoDate {
  const [y, m, d] = date.split('-').map((s) => Number.parseInt(s, 10))
  const dt = new Date(Date.UTC(y + years, m - 1, d))
  return dt.toISOString().slice(0, 10)
}

/**
 * Dispara el flag anti-elusión si hay una compra del mismo ISIN en la ventana
 * {anterior, posterior}. Ventana: 2 meses si ISIN español (ES), 1 año si
 * cualquier otro. Criterio conservador: avisamos, no diferimos.
 */
function detectAntiElusion(
  buyDates: readonly IsoDate[],
  saleDate: IsoDate,
  isin: string | undefined,
): boolean {
  const isSpanishMarket = isin?.startsWith('ES') ?? false
  const windowStart = isSpanishMarket
    ? addMonths(saleDate, -2)
    : addYears(saleDate, -1)
  const windowEnd = isSpanishMarket
    ? addMonths(saleDate, 2)
    : addYears(saleDate, 1)
  return buyDates.some(
    (bd) => bd >= windowStart && bd <= windowEnd && bd !== saleDate,
  )
}

function collectFifoEvents(
  docs: readonly StatementDocument[],
): FifoEvent[] {
  const events: FifoEvent[] = []
  for (const doc of docs) {
    for (const e of doc.events) {
      if (e.kind === 'trade') {
        events.push({ kind: e.side, trade: e })
      } else if (e.kind === 'dividend' && e.subtype === 'return-of-capital') {
        events.push({ kind: 'roc', dividend: e })
      }
    }
  }
  // Orden cronológico. Desempate: trades antes que ROC (así el ROC aplica a
  // los lotes ya existentes), y buys antes que sells del mismo día (evita que
  // un sell consuma un lote que acaba de abrirse con otra compra del mismo
  // día pero posterior por timestamp que hemos truncado a fecha).
  const kindRank: Record<FifoEvent['kind'], number> = {
    buy: 0,
    sell: 1,
    roc: 2,
  }
  events.sort((a, b) => {
    const dateA = a.kind === 'roc' ? a.dividend.date : a.trade.date
    const dateB = b.kind === 'roc' ? b.dividend.date : b.trade.date
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return kindRank[a.kind] - kindRank[b.kind]
  })
  return events
}

// ---------------------------------------------------------------------------
// Motor principal
// ---------------------------------------------------------------------------

export interface FifoResult {
  summary: IrpfGainLossSummary
  notices: ParserWarning[]
}

export function computeFifoGains(
  docs: readonly StatementDocument[],
  taxYear: number,
): FifoResult {
  const slots = new Map<string, InstrumentSlot>()
  const rows: IrpfGainLossRow[] = []
  const notices: ParserWarning[] = []
  const roundingGuard = 1e-6 // ignora imprecisiones sub-céntimo

  const events = collectFifoEvents(docs)

  for (const ev of events) {
    if (ev.kind === 'buy') {
      const t = ev.trade
      if (t.quantity <= 0) continue
      const key = instrumentKey(t.instrument)
      const slot =
        slots.get(key) ??
        ({
          instrument: t.instrument,
          lots: [],
          buyDates: [],
        } as InstrumentSlot)
      const totalCostEur = t.gross.eur + t.commission.eur
      slot.lots.push({
        date: t.date,
        quantityRemaining: t.quantity,
        costPerUnitEur: totalCostEur / t.quantity,
      })
      slot.buyDates.push(t.date)
      // Mantenemos el instrumento más enriquecido (por si el primer buy vino
      // sin ISIN pero un buy posterior sí lo trae tras el merge).
      if (!slot.instrument.isin && t.instrument.isin) {
        slot.instrument = t.instrument
      }
      slots.set(key, slot)
      continue
    }

    if (ev.kind === 'roc') {
      const d = ev.dividend
      const key = instrumentKey(d.instrument)
      const slot = slots.get(key)
      if (!slot) continue // ROC sin lotes abiertos: nos lo saltamos (info trivial)
      const totalRemaining = slot.lots.reduce(
        (s, l) => s + l.quantityRemaining,
        0,
      )
      if (totalRemaining <= 0) continue
      const reductionPerShare = d.gross.eur / totalRemaining
      for (const lot of slot.lots) {
        lot.costPerUnitEur = Math.max(
          0,
          lot.costPerUnitEur - reductionPerShare,
        )
      }
      continue
    }

    // SELL
    const t = ev.trade
    if (t.quantity <= 0) continue
    const key = instrumentKey(t.instrument)
    const slot = slots.get(key)
    const saleYear = Number.parseInt(t.date.slice(0, 4), 10)
    const saleProceedsEur = t.gross.eur - t.commission.eur

    let remainingToSell = t.quantity
    let acquisitionCostEur = 0
    let hasIncompleteBasis = false
    let acquisitionFrom: IsoDate | undefined
    let acquisitionTo: IsoDate | undefined

    if (slot) {
      while (remainingToSell > roundingGuard && slot.lots.length > 0) {
        const lot = slot.lots[0]
        const take = Math.min(lot.quantityRemaining, remainingToSell)
        acquisitionCostEur += take * lot.costPerUnitEur
        if (!acquisitionFrom || lot.date < acquisitionFrom) {
          acquisitionFrom = lot.date
        }
        if (!acquisitionTo || lot.date > acquisitionTo) {
          acquisitionTo = lot.date
        }
        lot.quantityRemaining -= take
        remainingToSell -= take
        if (lot.quantityRemaining <= roundingGuard) slot.lots.shift()
      }
    }

    if (remainingToSell > roundingGuard) {
      hasIncompleteBasis = true
    }

    // Solo emitimos notices y filas del ejercicio declarable: una venta de un
    // priorDoc que dispare base incompleta o anti-elusión NO es accionable
    // para esta declaración (pertenece a la del año en que se realizó).
    if (saleYear !== taxYear) continue

    if (hasIncompleteBasis) {
      notices.push({
        severity: 'warn',
        code: 'fifo-incomplete-basis',
        message: `Venta de ${t.instrument.symbol} el ${t.date}: faltan ${remainingToSell.toFixed(2)} acciones de base de coste (no hay compras previas suficientes en los extractos cargados). Coste faltante tratado como 0 €; revisa manualmente.`,
        eventId: t.id,
      })
    }

    const inst = slot?.instrument ?? t.instrument
    const gainLossEur = saleProceedsEur - acquisitionCostEur

    const antiElusionFlag =
      gainLossEur < -roundingGuard &&
      slot !== undefined &&
      detectAntiElusion(slot.buyDates, t.date, inst.isin)

    if (antiElusionFlag) {
      notices.push({
        severity: 'warn',
        code: 'fifo-anti-elusion',
        message: `Posible regla anti-elusión en ${inst.symbol} (${t.date}): pérdida con compra del mismo ISIN en ventana cercana. La AEAT difiere la pérdida hasta que se transmitan los títulos recomprados. Revisa con un asesor; el motor NO aplica el diferimiento automáticamente.`,
        eventId: t.id,
      })
    }

    rows.push({
      saleDate: t.date,
      symbol: inst.symbol,
      isin: inst.isin,
      name: inst.name,
      countryOfIssuer:
        inst.countryOfIssuer ?? (inst.isin ? inst.isin.slice(0, 2) : undefined),
      quantity: t.quantity,
      saleProceedsEur,
      acquisitionCostEur,
      gainLossEur,
      acquisitionFrom,
      acquisitionTo,
      hasIncompleteBasis,
      antiElusionFlag,
    })
  }

  // Ordenar filas por fecha de venta asc.
  rows.sort(
    (a, b) =>
      a.saleDate.localeCompare(b.saleDate) ||
      a.symbol.localeCompare(b.symbol),
  )

  const totalValorTransmisionEur = rows.reduce(
    (s, r) => s + r.saleProceedsEur,
    0,
  )
  const totalValorAdquisicionEur = rows.reduce(
    (s, r) => s + r.acquisitionCostEur,
    0,
  )
  const totalGananciasEur = rows
    .filter((r) => r.gainLossEur > 0)
    .reduce((s, r) => s + r.gainLossEur, 0)
  const totalPerdidasEur = rows
    .filter((r) => r.gainLossEur < 0)
    .reduce((s, r) => s + Math.abs(r.gainLossEur), 0)
  const netoEur = totalGananciasEur - totalPerdidasEur

  // Aviso informativo sobre acciones corporativas fuera de scope.
  if (rows.length > 0) {
    notices.push({
      severity: 'info',
      code: 'fifo-corporate-actions-oos',
      message:
        'El cálculo FIFO NO contempla acciones corporativas (splits, spinoffs, fusiones). Si tu broker ejecutó alguna, revisa que las cantidades y fechas sean coherentes; puede hacer falta ajuste manual.',
    })
  }

  const summary: IrpfGainLossSummary = {
    label:
      'Ganancias y pérdidas patrimoniales por transmisión de valores negociados',
    casillaNote:
      'Renta Web — "Ganancias y pérdidas patrimoniales derivadas de la transmisión de acciones admitidas a negociación" (apartado F2). La casilla concreta cambia por ejercicio; consulta el Manual Práctico AEAT del año declarado.',
    totalValorTransmisionEur,
    totalValorAdquisicionEur,
    totalGananciasEur,
    totalPerdidasEur,
    netoEur,
    rows,
  }

  return { summary, notices }
}
