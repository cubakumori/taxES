/**
 * Script de verificación offline: lee un DividendReport.csv real y muestra un
 * resumen de lo que el parser extrae. No toca red, no toca backend.
 *
 * Uso:
 *   npm run parse:sample                         # busca un fichero en samples/ o ibkr/
 *   npm run parse:sample -- ruta/al/fichero.csv  # fichero concreto
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseIbkrDividendReport } from '../src/lib/parser/index'
import type { DividendEvent, StatementEvent, WithholdingEvent } from '../src/lib/parser/index'

const CANDIDATES = [
  'samples/DividendReport.csv',
  'samples/ibkr/taxes/DividendReport.csv',
  'ibkr/taxes/U13173420.2025.DividendReport.csv',
]

function findInput(): string {
  const cliArg = process.argv[2]
  if (cliArg) return resolve(cliArg)
  for (const candidate of CANDIDATES) {
    const full = resolve(candidate)
    if (existsSync(full)) return full
  }
  throw new Error(
    `No se encontró el fichero de muestra. Pasa la ruta como argumento o copia el DividendReport a una de: ${CANDIDATES.join(', ')}`,
  )
}

function isDividend(e: StatementEvent): e is DividendEvent {
  return e.kind === 'dividend'
}
function isWithholding(e: StatementEvent): e is WithholdingEvent {
  return e.kind === 'withholding'
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const path = findInput()
console.log(`→ Parseando: ${path}\n`)
const text = readFileSync(path, 'utf8')
const doc = parseIbkrDividendReport(text)

console.log('Cuenta')
console.log(`  ID               : ${doc.accountInfo.accountId ?? '(desconocido)'}`)
console.log(`  Divisa base      : ${doc.accountInfo.baseCurrency}`)
console.log(`  Período          : ${doc.accountInfo.periodFrom} → ${doc.accountInfo.periodTo}`)
console.log(`  Ejercicio fiscal : ${doc.taxYear}`)
console.log(`  Broker           : ${doc.accountInfo.broker}`)
console.log(`  Parser v         : ${doc.parserVersion}`)
console.log()

const dividends = doc.events.filter(isDividend)
const withholdings = doc.events.filter(isWithholding)

console.log(`Eventos: ${doc.events.length}  (dividendos=${dividends.length}, retenciones=${withholdings.length})\n`)

// ---- Totales ----
const grossEur = dividends.reduce((s, d) => s + d.gross.eur, 0)
const rocEur = dividends
  .filter((d) => d.subtype === 'return-of-capital')
  .reduce((s, d) => s + d.gross.eur, 0)
const taxableEur = grossEur - rocEur
const withholdingEur = withholdings.reduce((s, w) => s + w.amount.eur, 0)
const foreignWithholdingEur = withholdings
  .filter((w) => w.scope === 'foreign-source')
  .reduce((s, w) => s + w.amount.eur, 0)
const spanishWithholdingEur = withholdings
  .filter((w) => w.scope === 'spanish')
  .reduce((s, w) => s + w.amount.eur, 0)

console.log('Totales en EUR')
console.log(`  Bruto dividendos (incl. ROC) : ${fmt(grossEur)}`)
console.log(`  Return of Capital (no tributa) : ${fmt(rocEur)}`)
console.log(`  Bruto dividendos tributables   : ${fmt(taxableEur)}`)
console.log(`  Retención total                : ${fmt(withholdingEur)}`)
console.log(`    · Retención en origen        : ${fmt(foreignWithholdingEur)}`)
console.log(`    · Retención española         : ${fmt(spanishWithholdingEur)}`)
console.log()

// ---- Por país ----
const byCountry = new Map<string, { count: number; gross: number; withheld: number }>()
for (const d of dividends) {
  if (d.subtype === 'return-of-capital') continue
  const k = d.countryOfSource
  const row = byCountry.get(k) ?? { count: 0, gross: 0, withheld: 0 }
  row.count += 1
  row.gross += d.gross.eur
  byCountry.set(k, row)
}
for (const w of withholdings) {
  const k = w.countryOfTax
  const row = byCountry.get(k) ?? { count: 0, gross: 0, withheld: 0 }
  row.withheld += w.amount.eur
  byCountry.set(k, row)
}

console.log('Desglose por país (tributables)')
console.log('  País   #div   Bruto EUR   Retención EUR')
for (const [country, row] of [...byCountry.entries()].sort()) {
  console.log(
    `   ${country.padEnd(4)}  ${String(row.count).padStart(4)}   ${fmt(row.gross).padStart(9)}   ${fmt(row.withheld).padStart(9)}`,
  )
}
console.log()

// ---- Warnings ----
if (doc.warnings.length > 0) {
  console.log(`Avisos: ${doc.warnings.length}`)
  for (const w of doc.warnings) {
    console.log(`  [${w.severity}] ${w.code}: ${w.message}`)
  }
} else {
  console.log('Sin avisos.')
}
