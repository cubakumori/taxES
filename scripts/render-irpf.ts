/**
 * Script de verificación del motor de reglas: parsea un DividendReport.csv y
 * muestra el resumen "Renta Web ready" con casillas, deducción por doble
 * imposición internacional, y avisos.
 *
 * Uso:
 *   npm run render:irpf                          # busca un fichero en samples/ o ibkr/
 *   npm run render:irpf -- ruta/al/fichero.csv   # fichero concreto
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseIbkrDividendReport } from '../src/lib/parser'
import { applyRulesIrpf2025 } from '../src/lib/rules'

const CANDIDATES = [
  'samples/DividendReport.csv',
  'samples/ibkr/taxes/DividendReport.csv',
  'ibkr/taxes/U13173420.2025.DividendReport.csv',
]

function findInput(): string {
  const cliArg = process.argv[2]
  if (cliArg) return resolve(cliArg)
  for (const c of CANDIDATES) {
    const full = resolve(c)
    if (existsSync(full)) return full
  }
  throw new Error(`No se encontró DividendReport.csv en: ${CANDIDATES.join(', ')}`)
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number): string {
  return n === 0 ? '—' : `${(n * 100).toFixed(0)}%`
}

const path = findInput()
const text = readFileSync(path, 'utf8')
const doc = parseIbkrDividendReport(text)
const irpf = applyRulesIrpf2025(doc)

const line = '─'.repeat(72)

console.log(`\nIRPF ${irpf.taxYear} — Resumen para Renta Web`)
console.log(`Cuenta ${irpf.accountId ?? '(anónima)'} · ${irpf.baseCurrency} · período ${irpf.period.from} → ${irpf.period.to}`)
console.log(`Motor: ${irpf.motorReglasVersion}  ·  Parser: v${irpf.parserVersion}\n`)

// ---------------------------------------------------------------------------
console.log(line)
console.log('RENDIMIENTOS DEL CAPITAL MOBILIARIO (base del ahorro)')
console.log(line)
const c = irpf.casillaDividendos
console.log(`  Casilla ${c.casilla} — ${c.label}`)
console.log(`    Ingresos íntegros     : ${fmt(c.ingresosIntegros).padStart(10)} €`)
console.log(`    Retenciones (España)  : ${fmt(c.retenciones).padStart(10)} €`)
console.log()

// ---------------------------------------------------------------------------
console.log(line)
console.log('DEDUCCIÓN — Doble imposición internacional (base del ahorro)')
console.log(line)
const dti = irpf.dobleImposicionInternacional
console.log(`  Rendimientos del capital mobiliario obtenidos en el extranjero : ${fmt(dti.rendimientosEur).padStart(10)} €`)
console.log(`  Impuesto satisfecho en el extranjero (deducible)                : ${fmt(dti.impuestoSatisfechoEur).padStart(10)} €`)
if (dti.impuestoExcedenteEur > 0.01) {
  console.log(`  Excedente no recuperable vía IRPF                               : ${fmt(dti.impuestoExcedenteEur).padStart(10)} €`)
}
console.log()

console.log('Desglose por país:')
console.log('  País  #Div      Bruto   Retenido  Conv.     Deducible   Excedente')
for (const row of dti.porPais) {
  const conv = row.hasTreaty ? pct(row.treatyRate) : 'NO'
  console.log(
    `   ${row.country.padEnd(2)}  ${String(row.dividendCount).padStart(4)}  ${fmt(row.grossEur).padStart(9)}  ${fmt(row.withheldEur).padStart(9)}  ${conv.padStart(4)}   ${fmt(row.deductibleEur).padStart(9)}   ${fmt(row.excessEur).padStart(9)}`,
  )
}
console.log()

// ---------------------------------------------------------------------------
if (irpf.avisos.length > 0) {
  console.log(line)
  console.log(`AVISOS (${irpf.avisos.length})`)
  console.log(line)
  const bySeverity = { error: [] as string[], warn: [] as string[], info: [] as string[] }
  for (const a of irpf.avisos) {
    bySeverity[a.severity].push(`[${a.code}] ${a.message}`)
  }
  for (const sev of ['error', 'warn', 'info'] as const) {
    if (bySeverity[sev].length === 0) continue
    const icon = sev === 'error' ? '✗' : sev === 'warn' ? '!' : 'i'
    for (const m of bySeverity[sev]) console.log(`  ${icon} ${m}`)
  }
  console.log()
}

console.log(line)
console.log('⚠ Esta aplicación NO es asesoramiento fiscal. Revisa los importes antes de')
console.log('  presentar y consulta con un asesor para casos particulares.')
console.log(line)
