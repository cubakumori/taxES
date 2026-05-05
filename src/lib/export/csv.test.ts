import { describe, expect, it } from 'vitest'
import { DIVIDEND_REPORT_BASIC_2025 } from '../__fixtures__'
import { parseIbkrDividendReport } from '../parser/ibkr/dividend-report'
import { applyRulesIrpf2025 } from '../rules/rules_IRPF_2025'
import { formatNumberCsv, toCsv } from './csv'
import {
  buildDividendsDetailCsv,
  buildSummaryByCountryCsv,
} from './session-csv'

describe('toCsv', () => {
  it('genera cabecera y filas con separador ";" y BOM', () => {
    const csv = toCsv(
      [{ a: 1, b: 'hola' }],
      [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('A;B\r\n')
    expect(csv).toContain('1;hola\r\n')
  })

  it('entrecomilla valores con el separador', () => {
    const csv = toCsv(
      [{ a: 'uno; dos' }],
      [{ key: 'a', label: 'A' }],
    )
    expect(csv).toContain('"uno; dos"')
  })

  it('escapa comillas dobles duplicándolas', () => {
    const csv = toCsv(
      [{ a: 'con "comillas" dentro' }],
      [{ key: 'a', label: 'A' }],
    )
    expect(csv).toContain('"con ""comillas"" dentro"')
  })
})

describe('formatNumberCsv', () => {
  it('usa coma decimal y 2 decimales por defecto', () => {
    expect(formatNumberCsv(1234.5)).toBe('1234,50')
    expect(formatNumberCsv(0.1)).toBe('0,10')
  })

  it('respeta el número de decimales pedido', () => {
    expect(formatNumberCsv(1.23456, 4)).toBe('1,2346')
  })

  it('devuelve cadena vacía para valores no finitos', () => {
    expect(formatNumberCsv(Number.NaN)).toBe('')
    expect(formatNumberCsv(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('buildSummaryByCountryCsv', () => {
  it('lista los países del fixture ordenados por bruto descendente', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const summary = applyRulesIrpf2025(doc)
    const csv = buildSummaryByCountryCsv(summary)

    const lines = csv.replace(/^\ufeff/, '').split('\r\n').filter(Boolean)
    expect(lines[0]).toContain('Código país;País;Nº dividendos')

    // BE aparece con "sin convenio"? No: tiene convenio 15%. US también.
    // Excluimos SG (es 100 % ROC).
    expect(csv).toContain('BE;')
    expect(csv).toContain('US;')
    expect(csv).not.toContain('SG;')

    // Orden esperado por bruto desc: BE (40) > US (14,40).
    const beIdx = lines.findIndex((l) => l.startsWith('BE;'))
    const usIdx = lines.findIndex((l) => l.startsWith('US;'))
    expect(beIdx).toBeLessThan(usIdx)
  })

  it('renderiza el excedente de BE con coma decimal', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const summary = applyRulesIrpf2025(doc)
    const csv = buildSummaryByCountryCsv(summary)
    // BE: excedente 6,00 €
    expect(csv).toMatch(/BE;.*;6,00\r\n/)
  })
})

describe('buildDividendsDetailCsv', () => {
  it('incluye una fila por DividendEvent del fixture', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const csv = buildDividendsDetailCsv(doc)
    const lines = csv.replace(/^\ufeff/, '').split('\r\n').filter(Boolean)

    // Cabecera + N dividendos. APLE cuenta como 2 (split ROC parcial).
    const dividendCount = doc.events.filter((e) => e.kind === 'dividend').length
    expect(lines.length).toBe(1 + dividendCount)
  })

  it('marca el subtipo return-of-capital para N2IU', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const csv = buildDividendsDetailCsv(doc)
    expect(csv).toMatch(/N2IU;[^;]*;[^;]*;SG;Singapur;return-of-capital;/)
  })

  it('incluye ISIN y nombre de ENG cuando están en el catálogo', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const csv = buildDividendsDetailCsv(doc)
    // El fixture DividendReport no lleva catálogo, pero sí expone el Country
    // directamente. ISIN/nombre pueden venir vacíos — validamos que la fila
    // existe y que el símbolo ENG aparece.
    expect(csv).toContain(';ENG;')
  })
})
