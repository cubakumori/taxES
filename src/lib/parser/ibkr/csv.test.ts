import { describe, expect, it } from 'vitest'
import { groupBySection, parseCsv, rowToRecord } from './csv'

describe('parseCsv', () => {
  it('parsea una fila simple', () => {
    expect(parseCsv('a,b,c\n')).toEqual([['a', 'b', 'c']])
  })

  it('parsea varias filas', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('elimina el BOM UTF-8 al principio', () => {
    const withBom = '\uFEFFa,b\n1,2'
    expect(parseCsv(withBom)[0]).toEqual(['a', 'b'])
  })

  it('respeta campos entrecomillados con comas dentro', () => {
    expect(parseCsv('a,"b,c",d\n')).toEqual([['a', 'b,c', 'd']])
  })

  it('desescapea "" como " dentro de campos entrecomillados', () => {
    expect(parseCsv('a,"di ""hola""",b\n')).toEqual([['a', 'di "hola"', 'b']])
  })

  it('tolera CRLF como separador de líneas', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('conserva campos vacíos', () => {
    expect(parseCsv('a,,c\n')).toEqual([['a', '', 'c']])
  })

  it('devuelve array vacío para string vacío', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('groupBySection', () => {
  it('agrupa filas por nombre de sección', () => {
    const rows = [
      ['A', 'Header', 'col1'],
      ['A', 'Data', 'v1'],
      ['A', 'Data', 'v2'],
      ['B', 'Header', 'colx'],
      ['B', 'Data', 'w'],
    ]
    const sections = groupBySection(rows)
    expect(sections.get('A')?.header).toEqual(['A', 'Header', 'col1'])
    expect(sections.get('A')?.rows).toHaveLength(2)
    expect(sections.get('B')?.header).toEqual(['B', 'Header', 'colx'])
    expect(sections.get('B')?.rows).toHaveLength(1)
  })

  it('no incluye la fila Header en rows', () => {
    const rows = [
      ['A', 'Header', 'h'],
      ['A', 'Data', 'd'],
    ]
    const sections = groupBySection(rows)
    expect(sections.get('A')?.rows.every((r) => r[1] !== 'Header')).toBe(true)
  })
})

describe('rowToRecord', () => {
  it('mapea columnas a un record usando el header', () => {
    const header = ['Section', 'Type', 'Date', 'Symbol', 'Amount']
    const row = ['Section', 'Data', '2025-01-01', 'ENG', '30.40']
    expect(rowToRecord(row, header)).toEqual({
      Date: '2025-01-01',
      Symbol: 'ENG',
      Amount: '30.40',
    })
  })

  it('omite las dos primeras columnas (Section, Type)', () => {
    const header = ['X', 'Y', 'name']
    const row = ['X', 'Data', 'foo']
    expect(rowToRecord(row, header)).toEqual({ name: 'foo' })
  })
})
