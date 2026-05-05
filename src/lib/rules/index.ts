export * from './types'
export {
  applyRulesIrpf2025,
  type Irpf2025Options,
  RULES_VERSION,
} from './rules_IRPF_2025'
export { computeFifoGains, FIFO_ENGINE_VERSION } from './fifo'
export type { FifoResult } from './fifo'
export { getTreatyInfo, TREATY_RATES_IRPF_2025 } from './treaty-rates'
export type { TreatyInfo } from './treaty-rates'
export { computeIbkrEquivalence } from './ibkr-equivalence'
export type { IbkrEquivalenceView } from './ibkr-equivalence'
export { getCountryName, COUNTRY_NAMES_ES } from './country-names'
