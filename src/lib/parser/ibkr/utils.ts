/**
 * Helpers compartidos entre los parsers de IBKR (DividendReport.csv,
 * Informe de Actividad.csv). Se mantienen aquí para evitar la duplicación
 * sutil de `uuid()`, `redactAccountId()` y la normalización de fechas.
 */

/** Parsea un número permisivamente. Devuelve 0 ante string vacío o no-numérico. */
export function num(s: string): number {
  if (!s) return 0
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** `U13173420` → `U…420`. Strings cortos se devuelven sin tocar. */
export function redactAccountId(s: string): string {
  return s.length <= 4 ? s : `${s[0]}…${s.slice(-3)}`
}

/**
 * UUID v4 robusto: usa `crypto.randomUUID` cuando está disponible (navegador
 * moderno, Node 20+) y cae a un polyfill `Math.random` para entornos antiguos
 * o tests aislados. La unicidad solo necesita ser fuerte por documento.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Normaliza una fecha de IBKR a `YYYY-MM-DD`.
 * Acepta:
 * - `20250430` → `2025-04-30` (formato compacto del DividendReport)
 * - `2025-04-30` → idem (Informe de Actividad)
 * - `2025-04-30, 13:58:30` → `2025-04-30` (datetime con coma)
 *
 * Devuelve el string original si no coincide con ninguno de los patrones
 * conocidos, para que el caller pueda decidir cómo reportarlo.
 */
export function normalizeIbkrDate(s: string): string {
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}
