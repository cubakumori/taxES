<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { downloadTextFile } from '@lib/export/csv'
import {
  AlertTriangle,
  ArrowLeft,
  CornerDownLeft,
  Download,
  Info,
  Printer,
  XCircle,
} from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import { formatEur, formatPct } from '@utils/format'
import {
  computeIbkrEquivalence,
  getCountryName,
  type IrpfCountrySummary,
  type IrpfNotice,
} from '@lib/rules'
import CountryDetailsModal from './CountryDetailsModal.vue'
import CrossValidationCard from './CrossValidationCard.vue'
import IbkrEquivalenceCard from './IbkrEquivalenceCard.vue'
import PassphraseDialog from './PassphraseDialog.vue'
import PlusvaliasView from './PlusvaliasView.vue'
import RetentionChart from './RetentionChart.vue'
import SortableTh from './SortableTh.vue'
import TermInfo from './TermInfo.vue'

const store = useSessionStore()

const summary = computed(() => store.summary!)
const dti = computed(() => summary.value.dobleImposicionInternacional)
const equivalence = computed(() => {
  if (!store.dividendDoc) return null
  return computeIbkrEquivalence(store.dividendDoc, summary.value.taxYear)
})

const crossValidation = computed(() => store.mergedDoc?.crossValidation ?? null)

// Modal de detalle por país
const selectedCountry = ref<string | null>(null)
function openCountryDetails(country: string): void {
  selectedCountry.value = country
}

// --- Sort state para la tabla por país ---
type SortField =
  | 'country'
  | 'count'
  | 'gross'
  | 'withheld'
  | 'treaty'
  | 'deductible'
  | 'excess'
type SortDir = 'asc' | 'desc'

const sortField = ref<SortField>('gross')
const sortDir = ref<SortDir>('desc')

function toggleSort(field: SortField): void {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'country' ? 'asc' : 'desc'
  }
}

function valueFor(row: IrpfCountrySummary, field: SortField): number | string {
  switch (field) {
    case 'country':
      return getCountryName(row.country)
    case 'count':
      return row.dividendCount
    case 'gross':
      return row.grossEur
    case 'withheld':
      return row.withheldEur
    case 'treaty':
      return row.hasTreaty ? row.treatyRate : -1
    case 'deductible':
      return row.deductibleEur
    case 'excess':
      return row.excessEur
  }
}

const sortedCountryRows = computed<IrpfCountrySummary[]>(() => {
  const rows = [...dti.value.porPais]
  const factor = sortDir.value === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const av = valueFor(a, sortField.value)
    const bv = valueFor(b, sortField.value)
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv, 'es') * factor
    }
    return ((av as number) - (bv as number)) * factor
  })
  return rows
})

/** Aviso con número de orden asignado (errores → warn → info). */
interface NumberedNotice extends IrpfNotice {
  number: number
}

const numberedNotices = computed<NumberedNotice[]>(() => {
  const { errors, warns, infos } = bucket.value
  return [...errors, ...warns, ...infos].map((n, i) => ({ ...n, number: i + 1 }))
})

interface NoticeBuckets {
  errors: IrpfNotice[]
  warns: IrpfNotice[]
  infos: IrpfNotice[]
}

const bucket = computed<NoticeBuckets>(() => {
  const b: NoticeBuckets = { errors: [], warns: [], infos: [] }
  for (const a of summary.value.avisos) {
    if (a.severity === 'error') b.errors.push(a)
    else if (a.severity === 'warn') b.warns.push(a)
    else b.infos.push(a)
  }
  return b
})

/** Por país, la lista de números de aviso asociados. */
const noticesByCountry = computed<Map<string, NumberedNotice[]>>(() => {
  const map = new Map<string, NumberedNotice[]>()
  for (const n of numberedNotices.value) {
    if (!n.anchorCountry) continue
    const arr = map.get(n.anchorCountry) ?? []
    arr.push(n)
    map.set(n.anchorCountry, arr)
  }
  return map
})

function scrollTo(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  // Si el destino está dentro de un <details> cerrado, lo abre primero.
  const details = el.closest('details') as HTMLDetailsElement | null
  if (details && !details.open) {
    details.open = true
  }
  // Un frame para que el DOM reacomode antes de hacer scroll.
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2')
    window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2')
    }, 1600)
  })
}

function severityStyles(sev: IrpfNotice['severity']): {
  badge: string
  card: string
  label: string
} {
  if (sev === 'error') {
    return {
      badge: 'bg-red-600 text-white hover:bg-red-700',
      card: 'bg-red-50 border-red-100',
      label: 'text-red-600',
    }
  }
  if (sev === 'warn') {
    return {
      badge: 'bg-amber-500 text-white hover:bg-amber-600',
      card: 'bg-amber-50 border-amber-100',
      label: 'text-amber-700',
    }
  }
  return {
    badge: 'bg-blue-500 text-white hover:bg-blue-600',
    card: 'bg-blue-50 border-blue-100',
    label: 'text-blue-600',
  }
}

function downloadJson(): void {
  const data = JSON.stringify(summary.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `irpf-${summary.value.taxYear}-resumen.json`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadSummaryCsv(): void {
  const csv = store.exportSummaryCsv()
  if (!csv) return
  downloadTextFile(csv, `irpf-${summary.value.taxYear}-resumen-por-pais.csv`)
}

function downloadDividendsCsv(): void {
  const csv = store.exportDividendsCsv()
  if (!csv) return
  downloadTextFile(csv, `irpf-${summary.value.taxYear}-dividendos-detalle.csv`)
}

function downloadPlusvaliasCsv(): void {
  const csv = store.exportPlusvaliasCsv()
  if (!csv) return
  downloadTextFile(csv, `irpf-${summary.value.taxYear}-plusvalias-fifo.csv`)
}

const exportMenuOpen = ref(false)
const exportMenuRoot = ref<HTMLElement | null>(null)
function closeExportMenu(): void {
  exportMenuOpen.value = false
}

const encryptDialogOpen = ref(false)
const encryptBusy = ref(false)
const encryptError = ref<string | null>(null)

function openEncryptDialog(): void {
  closeExportMenu()
  encryptError.value = null
  encryptDialogOpen.value = true
}

async function onEncryptSubmit(passphrase: string): Promise<void> {
  encryptBusy.value = true
  encryptError.value = null
  try {
    const envelope = await store.exportSessionEncrypted(passphrase)
    const accountId = summary.value.accountId ?? 'cuenta'
    downloadTextFile(
      envelope,
      `taxes-${summary.value.taxYear}-${accountId}.taxes-enc.json`,
      'application/json;charset=utf-8',
    )
    encryptDialogOpen.value = false
  } catch (err) {
    encryptError.value = err instanceof Error ? err.message : String(err)
  } finally {
    encryptBusy.value = false
  }
}
function onExportClickOutside(e: MouseEvent): void {
  if (!exportMenuOpen.value) return
  if (exportMenuRoot.value && !exportMenuRoot.value.contains(e.target as Node)) {
    exportMenuOpen.value = false
  }
}
function onExportEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') exportMenuOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onExportClickOutside)
  document.addEventListener('keydown', onExportEscape)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onExportClickOutside)
  document.removeEventListener('keydown', onExportEscape)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold">
          IRPF {{ summary.taxYear }} — Renta Web ready
        </h2>
        <p class="text-sm text-slate-500 mt-1">
          Cuenta {{ summary.accountId ?? '(anónima)' }} ·
          {{ summary.baseCurrency }} ·
          {{ summary.period.from }} → {{ summary.period.to }}
        </p>
        <p v-if="store.fileName" class="text-xs text-slate-400 mt-0.5 font-mono">
          {{ store.fileName }}
        </p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <RouterLink
          to="/imprimir"
          class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2 no-underline text-slate-700"
        >
          <Printer class="w-4 h-4" /> Imprimir / PDF
        </RouterLink>
        <div ref="exportMenuRoot" class="relative">
          <button
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
            :aria-expanded="exportMenuOpen"
            aria-haspopup="menu"
            @click="exportMenuOpen = !exportMenuOpen"
          >
            <Download class="w-4 h-4" /> Exportar
          </button>
          <div
            v-if="exportMenuOpen"
            class="absolute right-0 mt-1 w-60 rounded-lg border border-slate-200 bg-white shadow-lg z-20 py-1 text-sm"
            role="menu"
          >
            <button
              class="w-full text-left px-3 py-2 hover:bg-slate-50"
              role="menuitem"
              @click="downloadSummaryCsv(); closeExportMenu()"
            >
              CSV · resumen por país
              <div class="text-xs text-slate-500">Abre en Excel / Sheets</div>
            </button>
            <button
              class="w-full text-left px-3 py-2 hover:bg-slate-50"
              role="menuitem"
              @click="downloadDividendsCsv(); closeExportMenu()"
            >
              CSV · dividendos detalle
              <div class="text-xs text-slate-500">Fila por pago (incluye ROC)</div>
            </button>
            <button
              v-if="summary.plusvalias"
              class="w-full text-left px-3 py-2 hover:bg-slate-50"
              role="menuitem"
              @click="downloadPlusvaliasCsv(); closeExportMenu()"
            >
              CSV · plusvalías FIFO
              <div class="text-xs text-slate-500">Fila por venta con base de coste</div>
            </button>
            <button
              class="w-full text-left px-3 py-2 hover:bg-slate-50 border-t border-slate-100"
              role="menuitem"
              @click="downloadJson(); closeExportMenu()"
            >
              JSON · sesión completa
              <div class="text-xs text-slate-500">Respaldo reimportable</div>
            </button>
            <button
              class="w-full text-left px-3 py-2 hover:bg-slate-50"
              role="menuitem"
              @click="openEncryptDialog"
            >
              Backup cifrado · portable
              <div class="text-xs text-slate-500">AES-GCM con passphrase · seguro en Drive/USB</div>
            </button>
          </div>
        </div>
        <button
          class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
          title="Vuelve a la zona de carga sin borrar los archivos ya cargados"
          @click="store.backToUpload"
        >
          <ArrowLeft class="w-4 h-4" /> Añadir / cambiar archivo
        </button>
      </div>
    </div>

    <!-- Casilla 0029 -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        <TermInfo
          text="Parte del IRPF que grava dividendos, intereses y plusvalías con tipos progresivos más bajos que la base general (salarios, alquileres)."
          topic="base-ahorro"
        >
          Rendimientos del capital mobiliario (base del ahorro)
        </TermInfo>
      </h3>
      <div class="mt-3 flex items-baseline gap-3 flex-wrap">
        <span class="text-xs bg-slate-900 text-white px-2 py-0.5 rounded font-mono">
          Casilla {{ summary.casillaDividendos.casilla }}
        </span>
        <span class="text-sm text-slate-700">
          {{ summary.casillaDividendos.label }}
        </span>
      </div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">
            <TermInfo
              text="Suma de todos los dividendos brutos tributables en EUR (nacionales + extranjeros). Se declara el bruto, no el neto que ingresa el broker."
              topic="dividendos"
            >
              Ingresos íntegros
            </TermInfo>
          </div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(summary.casillaDividendos.ingresosIntegros) }}
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">
            <TermInfo
              text="SOLO retenciones practicadas en España (valores con ISIN español). Las extranjeras no van aquí; van en la deducción por doble imposición internacional."
              topic="dividendos"
            >
              Retenciones (España)
            </TermInfo>
          </div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(summary.casillaDividendos.retenciones) }}
          </div>
        </div>
      </div>
    </section>

    <!-- Doble imposición -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        <TermInfo
          text="Deducción que evita pagar dos veces por el mismo dividendo extranjero: España permite restar lo que ya te retuvieron en origen, con el tope del convenio bilateral con ese país."
          topic="doble-imposicion"
        >
          Deducción — Doble imposición internacional (base del ahorro)
        </TermInfo>
      </h3>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">
            Rendimientos obtenidos en el extranjero
          </div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(dti.rendimientosEur) }}
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">
            Impuesto satisfecho en el extranjero (deducible)
          </div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(dti.impuestoSatisfechoEur) }}
          </div>
        </div>
        <div
          v-if="dti.impuestoExcedenteEur > 0.01"
          class="bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <div class="text-xs text-amber-700 mb-1">
            <TermInfo
              text="Retención que te aplicaron en origen por encima del tope del convenio con España. NO se recupera en el IRPF. Reclamación posible al broker o país emisor."
              topic="doble-imposicion"
            >
              Excedente no recuperable vía IRPF
            </TermInfo>
          </div>
          <div class="text-2xl font-semibold tabular-nums text-amber-900">
            {{ formatEur(dti.impuestoExcedenteEur) }}
          </div>
        </div>
      </div>

      <!-- Desglose por país -->
      <div class="mt-6 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
              <SortableTh
                field="country"
                :current="sortField"
                :dir="sortDir"
                align="left"
                class="py-2"
                @sort="toggleSort"
              >País</SortableTh>
              <SortableTh field="count" :current="sortField" :dir="sortDir" @sort="toggleSort">#Div</SortableTh>
              <SortableTh field="gross" :current="sortField" :dir="sortDir" @sort="toggleSort">Bruto</SortableTh>
              <SortableTh field="withheld" :current="sortField" :dir="sortDir" @sort="toggleSort">Retenido</SortableTh>
              <SortableTh field="treaty" :current="sortField" :dir="sortDir" @sort="toggleSort">Convenio</SortableTh>
              <SortableTh field="deductible" :current="sortField" :dir="sortDir" @sort="toggleSort">Deducible</SortableTh>
              <SortableTh field="excess" :current="sortField" :dir="sortDir" @sort="toggleSort">Excedente</SortableTh>
              <th class="text-left">Avisos</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in sortedCountryRows"
              :key="row.country"
              :id="`pais-${row.country}`"
              class="rounded-md transition-shadow scroll-mt-20 cursor-pointer hover:bg-slate-50"
              :title="`Ver detalle de dividendos de ${getCountryName(row.country)}`"
              @click="openCountryDetails(row.country)"
            >
              <td class="py-2 pr-4">
                <span class="font-mono text-xs text-slate-500 mr-2">{{ row.country }}</span>
                <span class="underline decoration-dotted underline-offset-2">{{ getCountryName(row.country) }}</span>
              </td>
              <td class="text-right pr-4 tabular-nums">{{ row.dividendCount }}</td>
              <td class="text-right pr-4 tabular-nums">
                {{ formatEur(row.grossEur) }}
              </td>
              <td class="text-right pr-4 tabular-nums">
                {{ formatEur(row.withheldEur) }}
              </td>
              <td class="text-right pr-4 tabular-nums">
                <span v-if="row.hasTreaty">{{ formatPct(row.treatyRate) }}</span>
                <span v-else class="text-red-600 font-medium">sin conv.</span>
              </td>
              <td class="text-right pr-4 tabular-nums">
                {{ formatEur(row.deductibleEur) }}
              </td>
              <td
                class="text-right pr-4 tabular-nums"
                :class="
                  row.excessEur > 0.01 ? 'text-amber-700 font-medium' : 'text-slate-400'
                "
              >
                {{ formatEur(row.excessEur) }}
              </td>
              <td class="py-2 whitespace-nowrap">
                <button
                  v-for="n in noticesByCountry.get(row.country) ?? []"
                  :key="n.number"
                  type="button"
                  :class="[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold mr-1 transition-colors',
                    severityStyles(n.severity).badge,
                  ]"
                  :title="`Ver aviso ${n.number}: ${n.code}`"
                  @click.stop="scrollTo(`aviso-${n.number}`)"
                >
                  {{ n.number }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Avisos -->
    <details
      v-if="numberedNotices.length > 0"
      class="bg-white rounded-xl border border-slate-200 group"
    >
      <summary
        class="cursor-pointer list-none p-6 flex items-center justify-between gap-4 hover:bg-slate-50 rounded-xl transition-colors"
      >
        <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Avisos ({{ numberedNotices.length }})
        </h3>
        <span class="text-xs text-slate-500 shrink-0 group-open:hidden">mostrar</span>
        <span class="text-xs text-slate-500 shrink-0 hidden group-open:inline">ocultar</span>
      </summary>
      <div class="px-6 pb-6 space-y-2">
        <div
          v-for="n in numberedNotices"
          :key="n.number"
          :id="`aviso-${n.number}`"
          class="flex items-start gap-3 p-3 rounded-lg border transition-shadow scroll-mt-20"
          :class="severityStyles(n.severity).card"
        >
          <div class="flex items-center gap-2 shrink-0">
            <span
              :class="[
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold',
                severityStyles(n.severity).badge,
              ]"
              >{{ n.number }}</span
            >
            <XCircle
              v-if="n.severity === 'error'"
              class="w-5 h-5 text-red-500 shrink-0"
            />
            <AlertTriangle
              v-else-if="n.severity === 'warn'"
              class="w-5 h-5 text-amber-500 shrink-0"
            />
            <Info v-else class="w-5 h-5 text-blue-500 shrink-0" />
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="text-xs font-mono"
              :class="severityStyles(n.severity).label"
            >
              {{ n.code }}
            </div>
            <div class="text-sm text-slate-900">{{ n.message }}</div>
          </div>
          <button
            v-if="n.anchorCountry"
            type="button"
            class="shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded"
            :title="`Volver a la fila ${n.anchorCountry}`"
            @click="scrollTo(`pais-${n.anchorCountry}`)"
          >
            <CornerDownLeft class="w-3.5 h-3.5" /> {{ n.anchorCountry }}
          </button>
        </div>
      </div>
    </details>

    <!-- Plusvalías / minusvalías (FIFO) -->
    <PlusvaliasView
      v-if="summary.plusvalias"
      :plusvalias="summary.plusvalias"
    />

    <!-- Gráfico comparativo por país -->
    <RetentionChart
      v-if="dti.porPais.length > 0"
      :rows="dti.porPais"
    />

    <!-- Validación cruzada con el Informe de Actividad -->
    <CrossValidationCard
      v-if="crossValidation && crossValidation.available"
      :report="crossValidation"
    />

    <!-- Equivalencia con IBKR -->
    <IbkrEquivalenceCard
      v-if="equivalence"
      :equivalence="equivalence"
      :summary="summary"
    />

    <!-- El disclaimer lo provee el layout de Home.vue para no duplicarlo. -->

    <!-- Modal de detalle por país -->
    <CountryDetailsModal
      v-if="selectedCountry"
      :country="selectedCountry"
      @close="selectedCountry = null"
    />

    <!-- Diálogo de passphrase para el backup cifrado -->
    <PassphraseDialog
      :open="encryptDialogOpen"
      mode="export"
      :error-message="encryptError"
      :busy="encryptBusy"
      @update:open="(v) => !v && (encryptDialogOpen = false)"
      @submit="onEncryptSubmit"
    />
  </div>
</template>
