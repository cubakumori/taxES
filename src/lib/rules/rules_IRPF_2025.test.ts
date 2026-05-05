import { describe, expect, it } from 'vitest'
import { DIVIDEND_REPORT_BASIC_2025 } from '../__fixtures__'
import { parseIbkrDividendReport } from '../parser/ibkr/dividend-report'
import { applyRulesIrpf2025 } from './rules_IRPF_2025'

describe('applyRulesIrpf2025', () => {
  it('suma en Casilla 0029 solo los dividendos cash del ejercicio', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    // cash: ENG 30.40 + MO 10.80 + UCB 40.00 + APLE-cash 3.60 = 84.80
    expect(irpf.casillaDividendos.ingresosIntegros).toBeCloseTo(84.8, 2)
  })

  it('pone SOLO las retenciones españolas en Casilla 0029 / Retenciones', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    expect(irpf.casillaDividendos.retenciones).toBeCloseTo(5.78, 2)
  })

  it('suma rendimientos extranjeros excluyendo España', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    // foreign cash: MO 10.80 + UCB 40.00 + APLE-cash 3.60 = 54.40
    expect(irpf.dobleImposicionInternacional.rendimientosEur).toBeCloseTo(
      54.4,
      2,
    )
  })

  it('aplica el tope del convenio por país y calcula excedente', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    const be = irpf.dobleImposicionInternacional.porPais.find(
      (p) => p.country === 'BE',
    )
    // BE: bruto 40, retenido 12, convenio 15% → cap 6, deducible 6, excedente 6
    expect(be?.withholdingCapEur).toBeCloseTo(6.0, 2)
    expect(be?.deductibleEur).toBeCloseTo(6.0, 2)
    expect(be?.excessEur).toBeCloseTo(6.0, 2)
  })

  it('suma deducible y excedente globales correctamente', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    // BE: cap 6, deducible 6, excedente 6.
    // US: gross tributable 14.40 (MO 10.80 + APLE cash 3.60), cap 15% = 2.16.
    //   Retención USA atada al cash = MO 1.62 + APLE 0.64 (Summary.Withhold completo) = 2.26
    //   Deducible = 2.16, excedente = 0.10 (artefacto del ROC parcial de APLE)
    // Totales: deducible 8.16, excedente 6.10.
    expect(
      irpf.dobleImposicionInternacional.impuestoSatisfechoEur,
    ).toBeCloseTo(8.16, 2)
    expect(
      irpf.dobleImposicionInternacional.impuestoExcedenteEur,
    ).toBeCloseTo(6.1, 2)
  })

  it('emite aviso withholding-exceeds-treaty anclado al país BE', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    const beAviso = irpf.avisos.find(
      (a) =>
        a.code === 'withholding-exceeds-treaty' && a.anchorCountry === 'BE',
    )
    expect(beAviso).toBeDefined()
    expect(beAviso?.severity).toBe('warn')
  })

  it('NO incluye los dividendos ROC (N2IU) en los totales tributables', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    const sg = irpf.dobleImposicionInternacional.porPais.find(
      (p) => p.country === 'SG',
    )
    // N2IU es 100% ROC → SG no debería aparecer en la deducción por doble imposición.
    expect(sg).toBeUndefined()
  })

  it('usa como versión del motor "IRPF_2025_v0.1.0"', () => {
    const doc = parseIbkrDividendReport(DIVIDEND_REPORT_BASIC_2025)
    const irpf = applyRulesIrpf2025(doc)
    expect(irpf.motorReglasVersion).toMatch(/^IRPF_2025/)
  })
})
