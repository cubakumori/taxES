/**
 * Tipos máximos de retención en origen para dividendos según convenios de
 * doble imposición entre España y cada país.
 *
 * ⚠️ **Orientativo**. Para situaciones no estándar (participación ≥ 10 %,
 * fondos de pensiones, régimen especial) consultar el convenio específico.
 * Fuente canónica: BOE + https://www.hacienda.gob.es/ (CDI vigentes).
 *
 * Esta tabla se usa SOLO en el motor de reglas IRPF_2025. Si la AEAT o un
 * convenio cambia el tipo aplicable, crear una tabla nueva en el motor del
 * ejercicio siguiente, sin tocar esta.
 */

import type { CountryCode } from '../parser/types'

export interface TreatyInfo {
  /** Tipo máximo deducible por dividendo (0.15 = 15 %). 0 si no hay convenio. */
  rate: number
  hasTreaty: boolean
  /** Referencia breve al convenio aplicable. */
  source: string
  /** Notas operativas (régimen especial, casos dudosos). */
  note?: string
}

/**
 * Tabla de convenios aplicables a dividendos de cartera (inversor particular,
 * participación < 10 %). No cubre regímenes especiales.
 */
export const TREATY_RATES_IRPF_2025: Record<CountryCode, TreatyInfo> = {
  AT: { rate: 0.15, hasTreaty: true, source: 'CDI España-Austria' },
  AU: { rate: 0.15, hasTreaty: true, source: 'CDI España-Australia' },
  BE: { rate: 0.15, hasTreaty: true, source: 'CDI España-Bélgica' },
  BR: { rate: 0.15, hasTreaty: true, source: 'CDI España-Brasil' },
  CA: { rate: 0.15, hasTreaty: true, source: 'CDI España-Canadá' },
  CH: { rate: 0.15, hasTreaty: true, source: 'CDI España-Suiza' },
  CL: { rate: 0.10, hasTreaty: true, source: 'CDI España-Chile' },
  CN: { rate: 0.10, hasTreaty: true, source: 'CDI España-China 2018' },
  CZ: { rate: 0.15, hasTreaty: true, source: 'CDI España-Rep. Checa' },
  DE: { rate: 0.15, hasTreaty: true, source: 'CDI España-Alemania 2011' },
  DK: { rate: 0.15, hasTreaty: true, source: 'CDI España-Dinamarca' },
  EE: { rate: 0.15, hasTreaty: true, source: 'CDI España-Estonia' },
  FI: { rate: 0.15, hasTreaty: true, source: 'CDI España-Finlandia' },
  FR: { rate: 0.15, hasTreaty: true, source: 'CDI España-Francia 1995' },
  GB: { rate: 0.15, hasTreaty: true, source: 'CDI España-Reino Unido 2013' },
  GR: { rate: 0.10, hasTreaty: true, source: 'CDI España-Grecia' },
  HK: { rate: 0.10, hasTreaty: true, source: 'CDI España-Hong Kong 2012' },
  IE: { rate: 0.15, hasTreaty: true, source: 'CDI España-Irlanda' },
  IL: { rate: 0.10, hasTreaty: true, source: 'CDI España-Israel' },
  IN: { rate: 0.15, hasTreaty: true, source: 'CDI España-India' },
  IT: { rate: 0.15, hasTreaty: true, source: 'CDI España-Italia' },
  JP: { rate: 0.15, hasTreaty: true, source: 'CDI España-Japón 2018' },
  KR: { rate: 0.15, hasTreaty: true, source: 'CDI España-Corea del Sur' },
  LU: { rate: 0.15, hasTreaty: true, source: 'CDI España-Luxemburgo' },
  LV: { rate: 0.10, hasTreaty: true, source: 'CDI España-Letonia' },
  MX: { rate: 0.15, hasTreaty: true, source: 'CDI España-México 2017' },
  NL: { rate: 0.15, hasTreaty: true, source: 'CDI España-Países Bajos' },
  NO: { rate: 0.15, hasTreaty: true, source: 'CDI España-Noruega' },
  PH: { rate: 0.15, hasTreaty: true, source: 'CDI España-Filipinas' },
  PL: { rate: 0.15, hasTreaty: true, source: 'CDI España-Polonia' },
  PT: { rate: 0.15, hasTreaty: true, source: 'CDI España-Portugal' },
  SE: { rate: 0.15, hasTreaty: true, source: 'CDI España-Suecia' },
  SG: { rate: 0.05, hasTreaty: true, source: 'CDI España-Singapur 2011', note: '5 % para cartera; 0 % en ciertos casos. Verificar.' },
  TR: { rate: 0.15, hasTreaty: true, source: 'CDI España-Turquía' },
  TW: { rate: 0.10, hasTreaty: true, source: 'CDI España-Taiwán 2021', note: 'Convenio reciente; verificar aplicación.' },
  US: { rate: 0.15, hasTreaty: true, source: 'CDI España-EE.UU. Protocolo 2013', note: 'Requiere W-8BEN para el tipo reducido; si no, IBKR retiene 30 %.' },
  ZA: { rate: 0.15, hasTreaty: true, source: 'CDI España-Sudáfrica' },

  // Jurisdicciones sin convenio (retención no recuperable vía IRPF).
  BM: { rate: 0, hasTreaty: false, source: 'sin convenio', note: 'Bermudas' },
  KY: { rate: 0, hasTreaty: false, source: 'sin convenio', note: 'Islas Caimán' },
  MH: { rate: 0, hasTreaty: false, source: 'sin convenio', note: 'Islas Marshall' },
  VG: { rate: 0, hasTreaty: false, source: 'sin convenio', note: 'Islas Vírgenes Británicas' },
}

const UNKNOWN: TreatyInfo = {
  rate: 0,
  hasTreaty: false,
  source: 'desconocido',
  note: 'País no presente en la tabla; verificar si hay convenio vigente.',
}

export function getTreatyInfo(country: CountryCode): TreatyInfo {
  return TREATY_RATES_IRPF_2025[country] ?? UNKNOWN
}
