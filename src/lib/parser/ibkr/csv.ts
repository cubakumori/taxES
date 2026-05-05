/**
 * Tokenizer CSV para extractos de Interactive Brokers.
 *
 * Formato observado:
 * - Delimitador: `,`
 * - Encoding: UTF-8 (puede tener BOM)
 * - Line endings: LF (`\n`), tolerante a CRLF (`\r\n`)
 * - Quoting: dobles comillas `"` SOLO en campos que contienen comas
 *   (p. ej. datetime `"2025-11-25, 13:58:30"`). Escape de comillas con `""`.
 *
 * La estructura de los CSV de IBKR sigue el patrón:
 *   <NombreSección>,<Tipo>,<col1>,<col2>,...
 * donde `<Tipo>` ∈ {`Header`, `Data`, `SubTotal`, `Total`, ...}.
 */

export type CsvRow = string[]

/** Tokeniza un texto CSV en filas de campos. */
export function parseCsv(text: string): CsvRow[] {
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  const rows: CsvRow[] = []
  let field = ''
  let row: CsvRow = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      field = ''
      row = []
      continue
    }

    if (ch === '\r') continue

    field += ch
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Una sección del CSV: nombre, fila Header (si existe) y sus filas de datos. */
export interface CsvSection {
  name: string
  header: string[] | null
  rows: CsvRow[]
}

/**
 * Agrupa filas por nombre de sección (primera columna). La fila con `Header` en
 * la segunda columna se toma como definición de columnas. Las demás filas se
 * acumulan en `rows`.
 */
export function groupBySection(rows: CsvRow[]): Map<string, CsvSection> {
  const sections = new Map<string, CsvSection>()

  for (const row of rows) {
    if (row.length === 0) continue
    const [name, type] = row
    if (!name) continue

    let section = sections.get(name)
    if (!section) {
      section = { name, header: null, rows: [] }
      sections.set(name, section)
    }

    if (type === 'Header') {
      section.header = row
    } else {
      section.rows.push(row)
    }
  }

  return sections
}

/**
 * Construye un mapa `columna → valor` para una fila, usando el Header de la
 * sección. Las dos primeras columnas (nombre de sección, tipo) se omiten.
 */
export function rowToRecord(row: CsvRow, header: string[]): Record<string, string> {
  const rec: Record<string, string> = {}
  for (let i = 2; i < header.length; i++) {
    const key = header[i] ?? `col${i}`
    rec[key] = row[i] ?? ''
  }
  return rec
}
