/**
 * Checklist anual de preparación fiscal — estado persistido en IndexedDB
 * por `(taxYear, accountId)` usando el store `meta`. Si no hay sesión activa,
 * el checklist opera en memoria (sin persistir).
 *
 * Los ítems están fijados en código (IDs estables) para poder añadir o renombrar
 * sin romper el estado guardado: el user ve pasos nuevos desmarcados y los
 * antiguos que ya no existen simplemente se ignoran al leer.
 */

import { ref, watch, type Ref } from 'vue'
import { dbGet, dbPut, STORES } from '@lib/storage/db'

/** IDs estables. NO renombrar: al cambiar un id se pierde el estado guardado. */
export type ChecklistItemId =
  | 'dividend-report'
  | 'activity-statement'
  | 'fx-worksheet'
  | 'form-1042s'
  | 'form-nr4'
  | 'tax-vouchers'
  | 'w8ben'
  | 'backup-encrypted'
  | 'cross-validated'

export interface ChecklistItem {
  id: ChecklistItemId
  label: string
  hint?: string
  /** `optional: true` cuando el ítem puede no aplicar (el usuario lo marca igualmente o lo ignora). */
  optional?: boolean
}

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  {
    id: 'dividend-report',
    label: 'Descargado el DividendReport.csv del ejercicio',
    hint: 'IBKR Client Portal → Performance & Reports → Reports → Tax → Dividend Report.',
  },
  {
    id: 'activity-statement',
    label: 'Descargado el Informe de Actividad.csv del ejercicio',
    hint: 'Performance & Reports → Reports → Activity → anual, formato CSV.',
  },
  {
    id: 'fx-worksheet',
    label: 'Descargado el FX Income Worksheet (CSV/PDF)',
    hint: 'Respaldo del tipo de cambio aplicado por IBKR evento a evento. Útil si hay divisas fuera del BCE.',
    optional: true,
  },
  {
    id: 'form-1042s',
    label: 'Descargado el formulario 1042-S (si hubo dividendos de USA)',
    hint: 'Prueba oficial de retenciones estadounidenses. Disponible si tienes valores USA.',
    optional: true,
  },
  {
    id: 'form-nr4',
    label: 'Descargado el formulario NR4 (si hubo dividendos de Canadá)',
    hint: 'Prueba oficial de retenciones canadienses.',
    optional: true,
  },
  {
    id: 'tax-vouchers',
    label: 'Descargados los Dividend Tax Vouchers (UK, EU, CH…)',
    hint: 'Recibo por dividendo individual. Útil si Hacienda pide justificante concreto.',
    optional: true,
  },
  {
    id: 'w8ben',
    label: 'W-8BEN vigente (se renueva cada ~3 años)',
    hint: 'Obligatorio si tienes dividendos USA; sin él la retención sube del 15 % al 30 %.',
  },
  {
    id: 'backup-encrypted',
    label: 'Backup cifrado de la sesión hecho (opcional pero recomendado)',
    hint: 'Desde el menú Exportar → «Backup cifrado · portable». Guárdalo en Drive / USB.',
    optional: true,
  },
  {
    id: 'cross-validated',
    label: 'Resumen cuadrado contra el Dividend Revenue Summary de IBKR',
    hint: 'En el HTML del Dividend Report, sección «Dividend Revenue Summary». La app tiene un panel «Verificación» para cotejar al céntimo.',
  },
] as const

export type ChecklistState = Partial<Record<ChecklistItemId, boolean>>

function makeKey(taxYear: number, accountId: string): string {
  return `checklist-${taxYear}-${accountId}`
}

/** Carga el estado guardado (o `{}` si no existe). Silencioso ante errores. */
async function loadState(key: string): Promise<ChecklistState> {
  try {
    const stored = await dbGet<ChecklistState>(STORES.meta, key)
    return stored ?? {}
  } catch {
    return {}
  }
}

export interface UseAnnualChecklist {
  state: Ref<ChecklistState>
  loading: Ref<boolean>
  reset: () => Promise<void>
  completedCount: Ref<number>
  totalRequired: number
}

/**
 * Mantiene el checklist reactivo, hidratado desde IDB y auto-persistente al
 * modificarlo. Si no hay sesión activa (`taxYear` o `accountId` null), opera en
 * memoria sin persistir.
 */
export function useAnnualChecklist(
  taxYear: Ref<number | null>,
  accountId: Ref<string | null>,
): UseAnnualChecklist {
  const state = ref<ChecklistState>({})
  const loading = ref(false)

  async function hydrate(): Promise<void> {
    if (taxYear.value === null || accountId.value === null) {
      state.value = {}
      return
    }
    loading.value = true
    state.value = await loadState(makeKey(taxYear.value, accountId.value))
    loading.value = false
  }

  void hydrate()

  watch([taxYear, accountId], () => {
    void hydrate()
  })

  // Persistencia: escritura optimista en IDB tras cada cambio.
  watch(
    state,
    (newState) => {
      if (taxYear.value === null || accountId.value === null) return
      const key = makeKey(taxYear.value, accountId.value)
      void dbPut(STORES.meta, { ...newState }, key).catch((err) => {
        console.error('No se pudo guardar el checklist en IndexedDB:', err)
      })
    },
    { deep: true },
  )

  async function reset(): Promise<void> {
    state.value = {}
  }

  const completedCount = ref(0)
  watch(
    state,
    (s) => {
      completedCount.value = CHECKLIST_ITEMS.filter(
        (item) => !item.optional && s[item.id],
      ).length
    },
    { deep: true, immediate: true },
  )

  const totalRequired = CHECKLIST_ITEMS.filter((i) => !i.optional).length

  return { state, loading, reset, completedCount, totalRequired }
}
