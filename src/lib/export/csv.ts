/**
 * Generación de CSV compatible con Excel en entorno es-ES.
 *
 * Convenciones:
 * - Separador `;` (Excel es-ES lo usa por defecto; evita ambigüedad con la coma
 *   decimal del locale español).
 * - Decimales con coma para que Excel los reconozca como número en es-ES.
 * - BOM UTF-8 al inicio para que Excel detecte la codificación sin que el
 *   usuario tenga que hacer "Importar datos" manualmente.
 * - Valores con `;`, `"` o salto de línea se entrecomillan; las comillas
 *   internas se escapan duplicándolas (RFC 4180).
 */

export const CSV_SEPARATOR = ';'
const BOM = '\ufeff'

export interface CsvColumn<T> {
  key: keyof T & string
  label: string
  /** Transforma el valor a string. Por defecto usa `String()`. */
  format?: (value: T[keyof T & string], row: T) => string
}

/** Escapa un campo siguiendo RFC 4180 adaptado al separador configurado. */
function escape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (s.includes(CSV_SEPARATOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Formatea un número con coma decimal y 2 decimales por defecto. */
export function formatNumberCsv(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return ''
  return value.toFixed(decimals).replace('.', ',')
}

/** Serializa filas a CSV con BOM y cabecera. */
export function toCsv<T extends object>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
): string {
  const header = columns.map((c) => escape(c.label)).join(CSV_SEPARATOR)
  const body = rows.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key]
        const formatted = col.format
          ? col.format(raw as T[keyof T & string], row)
          : String(raw ?? '')
        return escape(formatted)
      })
      .join(CSV_SEPARATOR),
  )
  return BOM + [header, ...body].join('\r\n') + '\r\n'
}

/** Dispara la descarga de un string como archivo en el navegador. */
export function downloadTextFile(
  content: string,
  filename: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
