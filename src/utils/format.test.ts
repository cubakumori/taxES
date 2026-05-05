import { describe, expect, it } from 'vitest'
import { formatEur, formatPct } from './format'

describe('formatEur', () => {
  it('usa coma decimal con dos decimales y sufijo €', () => {
    // El separador de miles depende de la data ICU disponible en Node.
    expect(formatEur(1234.5)).toMatch(/^1\.?234,50\s?€$/)
  })

  it('formatea 0 como 0,00 €', () => {
    expect(formatEur(0)).toBe('0,00 €')
  })

  it('formatea negativos', () => {
    const s = formatEur(-42.1)
    expect(s).toContain('42,10')
    expect(s).toContain('€')
  })
})

describe('formatPct', () => {
  it('muestra guión para 0', () => {
    expect(formatPct(0)).toBe('—')
  })

  it('formatea como porcentaje entero', () => {
    expect(formatPct(0.15)).toBe('15 %')
    expect(formatPct(0.3)).toBe('30 %')
  })
})
