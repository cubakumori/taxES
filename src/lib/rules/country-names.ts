/**
 * Nombres de país en español para códigos ISO 3166-1 alpha-2.
 * Cubre las jurisdicciones presentes en la tabla de convenios + alguna extra.
 */

import type { CountryCode } from '../parser/types'

export const COUNTRY_NAMES_ES: Record<CountryCode, string> = {
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Bélgica',
  BM: 'Bermudas',
  BR: 'Brasil',
  CA: 'Canadá',
  CH: 'Suiza',
  CL: 'Chile',
  CN: 'China',
  CZ: 'República Checa',
  DE: 'Alemania',
  DK: 'Dinamarca',
  EE: 'Estonia',
  ES: 'España',
  FI: 'Finlandia',
  FR: 'Francia',
  GB: 'Reino Unido',
  GR: 'Grecia',
  HK: 'Hong Kong',
  IE: 'Irlanda',
  IL: 'Israel',
  IN: 'India',
  IT: 'Italia',
  JP: 'Japón',
  KR: 'Corea del Sur',
  KY: 'Islas Caimán',
  LU: 'Luxemburgo',
  LV: 'Letonia',
  MH: 'Islas Marshall',
  MX: 'México',
  NL: 'Países Bajos',
  NO: 'Noruega',
  NZ: 'Nueva Zelanda',
  PH: 'Filipinas',
  PL: 'Polonia',
  PT: 'Portugal',
  SE: 'Suecia',
  SG: 'Singapur',
  TH: 'Tailandia',
  TR: 'Turquía',
  TW: 'Taiwán',
  US: 'Estados Unidos',
  VG: 'Islas Vírgenes Británicas',
  ZA: 'Sudáfrica',
}

export function getCountryName(code: CountryCode): string {
  return COUNTRY_NAMES_ES[code] ?? code
}
