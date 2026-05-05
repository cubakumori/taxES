/**
 * Verificación offline del parser de `Informe de Actividad.csv`.
 *
 * Uso:
 *   npm run parse:activity
 *   npm run parse:activity -- ruta/al/fichero.csv
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseIbkrActivityStatement } from '../src/lib/parser/index'
import type {
  CashTransactionEvent,
  FeeEvent,
  StatementEvent,
  TradeEvent,
} from '../src/lib/parser/index'

const CANDIDATES = [
  'samples/ActivityStatement.csv',
  'samples/Informe de Actividad.csv',
  'ibkr/Informe de Actividad.csv',
]

function findInput(): string {
  const cliArg = process.argv[2]
  if (cliArg) return resolve(cliArg)
  for (const c of CANDIDATES) {
    const full = resolve(c)
    if (existsSync(full)) return full
  }
  throw new Error(`No se encontró el Informe de Actividad en: ${CANDIDATES.join(', ')}`)
}

const isTrade = (e: StatementEvent): e is TradeEvent => e.kind === 'trade'
const isFee = (e: StatementEvent): e is FeeEvent => e.kind === 'fee'
const isCash = (e: StatementEvent): e is CashTransactionEvent =>
  e.kind === 'cash-transaction'

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const path = findInput()
console.log(`→ Parseando: ${path}\n`)
const text = readFileSync(path, 'utf8')
const doc = parseIbkrActivityStatement(text)

console.log('Cuenta')
console.log(`  ID               : ${doc.accountInfo.accountId ?? '(desconocido)'}`)
console.log(`  Divisa base      : ${doc.accountInfo.baseCurrency}`)
console.log(`  Período          : ${doc.accountInfo.periodFrom} → ${doc.accountInfo.periodTo}`)
console.log(`  Ejercicio fiscal : ${doc.taxYear}`)
console.log(`  Parser v         : ${doc.parserVersion}`)
console.log()

const trades = doc.events.filter(isTrade)
const fees = doc.events.filter(isFee)
const cash = doc.events.filter(isCash)

console.log(`Eventos: ${doc.events.length}`)
console.log(`  · Trades           : ${trades.length}`)
console.log(`  · Fees             : ${fees.length}`)
console.log(`  · Cash movements   : ${cash.length}`)
console.log()

// ---- Trades ----
if (trades.length > 0) {
  console.log('Trades')
  console.log(`  Por divisa:`)
  const byCcy = new Map<string, { count: number; buy: number; sell: number }>()
  for (const t of trades) {
    const r = byCcy.get(t.gross.currency) ?? { count: 0, buy: 0, sell: 0 }
    r.count += 1
    if (t.side === 'buy') r.buy += t.gross.amount
    else r.sell += t.gross.amount
    byCcy.set(t.gross.currency, r)
  }
  for (const [ccy, r] of [...byCcy.entries()].sort()) {
    console.log(
      `    ${ccy.padEnd(4)}  ${String(r.count).padStart(4)} ops · buy ${fmt(r.buy).padStart(10)} · sell ${fmt(r.sell).padStart(10)}`,
    )
  }
  console.log()
}

// ---- Fees ----
if (fees.length > 0) {
  console.log('Fees')
  const byType = new Map<string, { count: number; eur: number }>()
  for (const f of fees) {
    const r = byType.get(f.feeType) ?? { count: 0, eur: 0 }
    r.count += 1
    r.eur += f.amount.eur
    byType.set(f.feeType, r)
  }
  for (const [type, r] of [...byType.entries()].sort()) {
    console.log(`  ${type.padEnd(12)}  ${String(r.count).padStart(4)} · ${fmt(r.eur).padStart(10)} € (sólo EUR)`)
  }
  console.log()
}

// ---- Cash ----
if (cash.length > 0) {
  console.log('Cash movements (EUR)')
  const deposits = cash.filter((c) => c.txType === 'deposit').reduce((s, c) => s + c.amount.eur, 0)
  const withdrawals = cash.filter((c) => c.txType === 'withdrawal').reduce((s, c) => s + c.amount.eur, 0)
  console.log(`  Depósitos:   ${fmt(deposits).padStart(10)} €`)
  console.log(`  Retiradas:   ${fmt(withdrawals).padStart(10)} €`)
  console.log()
}

// ---- Warnings ----
if (doc.warnings.length > 0) {
  console.log(`Avisos: ${doc.warnings.length}`)
  const byCode = new Map<string, number>()
  for (const w of doc.warnings) byCode.set(w.code, (byCode.get(w.code) ?? 0) + 1)
  for (const [code, n] of [...byCode.entries()].sort()) {
    console.log(`  [${n}x] ${code}`)
  }
}
