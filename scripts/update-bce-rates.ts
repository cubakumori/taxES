/**
 * Actualiza `src/lib/fx/bce-rates.json` con los tipos de cambio de referencia
 * del Banco Central Europeo.
 *
 * Fuente: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip
 * Formato ECB: `1 EUR = X <currency>` (para convertir X a EUR, dividir entre
 * el rate). Actualizar cuando convenga; el JSON es data estática y se comitea.
 *
 * Uso: `npm run fx:update`
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, '..', 'src', 'lib', 'fx', 'bce-rates.json')

/** Año mínimo a incluir. Anteriores se recortan para ahorrar tamaño. */
const MIN_YEAR = 2020

/** Divisas a conservar (el ECB publica muchas históricas hoy descontinuadas). */
const KEEP_CURRENCIES = new Set([
  'USD', 'JPY', 'BGN', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK',
  'CHF', 'ISK', 'NOK', 'AUD', 'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS',
  'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'ZAR', 'TRY',
])

async function fetchCsv(): Promise<string> {
  const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip'
  console.log(`Descargando ${url}…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ECB devolvió HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const tmpZip = join(tmpdir(), 'taxes-ecb-eurofxref.zip')
  writeFileSync(tmpZip, buf)
  const result = spawnSync('unzip', ['-p', tmpZip], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`unzip falló: ${result.stderr}`)
  }
  return result.stdout
}

interface Bundle {
  updatedAt: string
  currencies: string[]
  rates: Record<string, Record<string, number>>
}

async function main(): Promise<void> {
  const csv = await fetchCsv()
  const lines = csv.split('\n').filter(Boolean)
  if (lines.length < 2) {
    throw new Error('CSV inesperado: menos de 2 líneas')
  }

  const headers = lines[0].split(',')
  if (headers[0] !== 'Date') {
    throw new Error('La primera columna debe ser "Date"')
  }
  const currencyIndices: Array<{ code: string; idx: number }> = []
  for (let i = 1; i < headers.length; i++) {
    const code = headers[i].trim()
    if (!code) continue
    if (!KEEP_CURRENCIES.has(code)) continue
    currencyIndices.push({ code, idx: i })
  }
  const keptCodes = currencyIndices.map((c) => c.code).sort()
  console.log(`Columnas conservadas: ${keptCodes.join(', ')}`)

  const rates: Record<string, Record<string, number>> = {}
  let totalRows = 0
  let keptRows = 0

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const date = cols[0]?.trim()
    if (!date) continue
    totalRows += 1
    const year = Number.parseInt(date.slice(0, 4), 10)
    if (year < MIN_YEAR) continue

    const dayRates: Record<string, number> = {}
    for (const { code, idx } of currencyIndices) {
      const raw = cols[idx]?.trim()
      if (!raw || raw === 'N/A') continue
      const n = Number.parseFloat(raw)
      if (!Number.isFinite(n) || n <= 0) continue
      dayRates[code] = n
    }
    if (Object.keys(dayRates).length > 0) {
      rates[date] = dayRates
      keptRows += 1
    }
  }

  const bundle: Bundle = {
    updatedAt: new Date().toISOString(),
    currencies: keptCodes,
    rates,
  }

  const json = JSON.stringify(bundle)
  writeFileSync(OUTPUT, json, 'utf8')
  const sizeKb = (json.length / 1024).toFixed(1)
  console.log(
    `OK → ${OUTPUT}\n  ${keptRows} fechas conservadas (de ${totalRows} totales, desde ${MIN_YEAR})\n  ${keptCodes.length} divisas\n  ${sizeKb} KB`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
