/**
 * Detecta si un CSV es un `DividendReport.csv` o un `Informe de Actividad.csv`
 * de Interactive Brokers mirando la primera línea (ignorando BOM).
 */

export type IbkrFileType = 'dividend-report' | 'activity-statement' | 'unknown'

export function detectIbkrFileType(csvText: string): IbkrFileType {
  const clean =
    csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText
  const firstLine = clean.split('\n', 1)[0].trim()

  // DividendReport empieza con `Account,Header,AccountNumber,...`.
  if (firstLine.startsWith('Account,')) return 'dividend-report'

  // Informe de Actividad empieza con `Statement,Header,...`.
  if (firstLine.startsWith('Statement,')) return 'activity-statement'

  return 'unknown'
}
