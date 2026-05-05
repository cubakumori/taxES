/** Formateadores de números para la UI. Todos usan locale es-ES. */

export function formatEur(n: number): string {
  return `${n.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export function formatPct(rate: number): string {
  if (rate === 0) return '—'
  return `${(rate * 100).toFixed(0)} %`
}
