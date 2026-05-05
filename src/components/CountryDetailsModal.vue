<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import { formatEur } from '@utils/format'
import { getCountryName } from '@lib/rules'
import type {
  DividendEvent,
  StatementEvent,
  WithholdingEvent,
} from '@lib/parser'

const props = defineProps<{ country: string }>()
const emit = defineEmits<{ close: [] }>()

const store = useSessionStore()

const isDividend = (e: StatementEvent): e is DividendEvent =>
  e.kind === 'dividend'
const isWithholding = (e: StatementEvent): e is WithholdingEvent =>
  e.kind === 'withholding'

const events = computed(() => store.mergedDoc?.events ?? [])

const dividends = computed(() =>
  events.value
    .filter(isDividend)
    .filter((d) => d.countryOfSource === props.country)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const withholdingsById = computed(() => {
  const map = new Map<string, WithholdingEvent>()
  for (const e of events.value.filter(isWithholding)) map.set(e.id, e)
  return map
})

// ---------------------------------------------------------------------------
// Totales
// ---------------------------------------------------------------------------

const totalGross = computed(() =>
  dividends.value.reduce((s, d) => s + d.gross.eur, 0),
)
const totalTaxable = computed(() =>
  dividends.value
    .filter((d) => d.subtype === 'cash')
    .reduce((s, d) => s + d.gross.eur, 0),
)
const totalRoc = computed(() =>
  dividends.value
    .filter((d) => d.subtype === 'return-of-capital')
    .reduce((s, d) => s + d.gross.eur, 0),
)
const totalWithheld = computed(() =>
  dividends.value
    .map((d) =>
      d.withholdingId ? withholdingsById.value.get(d.withholdingId) : null,
    )
    .filter((w): w is WithholdingEvent => w !== null && w !== undefined)
    .reduce((s, w) => s + w.amount.eur, 0),
)

/**
 * Conteo de "dividendos" que usa el resto de la app: eventos únicos por
 * (símbolo, fecha). Un dividendo con componente ROC parcial genera 2
 * DividendEvent pero cuenta como UN pago real.
 */
const paymentCount = computed(() => {
  const set = new Set<string>()
  for (const d of dividends.value) set.add(`${d.instrument.symbol}|${d.date}`)
  return set.size
})

const companyCount = computed(() => {
  const set = new Set<string>()
  for (const d of dividends.value) set.add(d.instrument.symbol)
  return set.size
})

// ---------------------------------------------------------------------------
// Resumen por empresa
// ---------------------------------------------------------------------------

interface CompanySummary {
  symbol: string
  name?: string
  isin?: string
  paymentCount: number
  grossEur: number
  taxableEur: number
  rocEur: number
  withheldEur: number
  firstDate: string
  lastDate: string
  hasRoc: boolean
}

const byCompany = computed<CompanySummary[]>(() => {
  const map = new Map<string, { c: CompanySummary; dates: Set<string> }>()
  for (const d of dividends.value) {
    const sym = d.instrument.symbol
    let entry = map.get(sym)
    if (!entry) {
      entry = {
        c: {
          symbol: sym,
          name: d.instrument.name,
          isin: d.instrument.isin,
          paymentCount: 0,
          grossEur: 0,
          taxableEur: 0,
          rocEur: 0,
          withheldEur: 0,
          firstDate: d.date,
          lastDate: d.date,
          hasRoc: false,
        },
        dates: new Set<string>(),
      }
      map.set(sym, entry)
    }
    // Enriquecer si alguna instancia trae name/isin y la primera no.
    entry.c.name = entry.c.name ?? d.instrument.name
    entry.c.isin = entry.c.isin ?? d.instrument.isin
    entry.dates.add(d.date)
    entry.c.grossEur += d.gross.eur
    if (d.subtype === 'cash') entry.c.taxableEur += d.gross.eur
    if (d.subtype === 'return-of-capital') {
      entry.c.rocEur += d.gross.eur
      entry.c.hasRoc = true
    }
    if (d.withholdingId) {
      const wh = withholdingsById.value.get(d.withholdingId)
      if (wh) entry.c.withheldEur += wh.amount.eur
    }
    if (d.date < entry.c.firstDate) entry.c.firstDate = d.date
    if (d.date > entry.c.lastDate) entry.c.lastDate = d.date
  }
  const out = [...map.values()].map((e) => {
    e.c.paymentCount = e.dates.size
    return e.c
  })
  out.sort((a, b) => b.grossEur - a.grossEur)
  return out
})

function formatDateRange(first: string, last: string): string {
  if (first === last) return first
  return `${first} → ${last}`
}

// ---------------------------------------------------------------------------
// Comportamiento del modal
// ---------------------------------------------------------------------------

function onBackdropClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit('close')
}
function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onEscape))
onUnmounted(() => window.removeEventListener('keydown', onEscape))
</script>

<template>
  <div
    class="fixed inset-0 bg-slate-900/40 z-50 flex items-start justify-center p-4 sm:p-8"
    @click="onBackdropClick"
  >
    <div
      class="bg-white rounded-xl shadow-xl max-w-3xl w-full flex flex-col max-h-full"
    >
      <div
        class="flex items-start justify-between p-6 border-b border-slate-200 shrink-0"
      >
        <div>
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-xs text-slate-500">{{ country }}</span>
            <h2 class="text-xl font-bold">{{ getCountryName(country) }}</h2>
          </div>
          <p class="text-sm text-slate-500 mt-1">
            {{ paymentCount }} dividendo{{ paymentCount === 1 ? '' : 's' }} ·
            {{ companyCount }} empresa{{ companyCount === 1 ? '' : 's' }}
          </p>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-slate-100 shrink-0"
          aria-label="Cerrar"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto">
        <!-- Totales -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500">Bruto total</div>
            <div class="tabular-nums font-semibold">{{ formatEur(totalGross) }}</div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500">Tributable</div>
            <div class="tabular-nums font-semibold">{{ formatEur(totalTaxable) }}</div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500">ROC (no tributa)</div>
            <div class="tabular-nums font-semibold">{{ formatEur(totalRoc) }}</div>
          </div>
          <div class="bg-slate-50 rounded-lg p-3">
            <div class="text-xs text-slate-500">Retenido</div>
            <div class="tabular-nums font-semibold">{{ formatEur(totalWithheld) }}</div>
          </div>
        </div>

        <!-- Por empresa -->
        <section>
          <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Por empresa
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th class="text-left py-2 pr-3">Valor</th>
                  <th class="text-right pr-3">#Div</th>
                  <th class="text-left pr-3 hidden sm:table-cell">Fechas</th>
                  <th class="text-right pr-3">Bruto EUR</th>
                  <th class="text-right">Retenido EUR</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="c in byCompany" :key="c.symbol">
                  <td class="py-2 pr-3">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-mono text-xs">{{ c.symbol }}</span>
                      <span
                        v-if="c.hasRoc"
                        class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded"
                        title="Incluye componente Return of Capital"
                        >ROC</span
                      >
                    </div>
                    <div
                      v-if="c.name"
                      class="text-xs text-slate-500 truncate max-w-[14rem] sm:max-w-xs"
                      :title="c.name + (c.isin ? ' · ' + c.isin : '')"
                    >
                      {{ c.name }}
                    </div>
                    <div
                      v-if="c.isin"
                      class="text-[10px] text-slate-400 font-mono hidden sm:block"
                    >
                      {{ c.isin }}
                    </div>
                  </td>
                  <td class="text-right pr-3 tabular-nums">{{ c.paymentCount }}</td>
                  <td
                    class="pr-3 tabular-nums font-mono text-xs text-slate-600 hidden sm:table-cell"
                  >
                    {{ formatDateRange(c.firstDate, c.lastDate) }}
                  </td>
                  <td class="text-right pr-3 tabular-nums">
                    {{ formatEur(c.grossEur) }}
                  </td>
                  <td class="text-right tabular-nums">
                    {{ formatEur(c.withheldEur) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Detalle por dividendo (colapsable) -->
        <details class="group border-t border-slate-200 pt-3 -mt-2">
          <summary
            class="cursor-pointer list-none flex items-center justify-between py-2"
          >
            <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Detalle línea a línea ({{ dividends.length }})
            </h3>
            <span class="text-xs text-slate-500 group-open:hidden">mostrar</span>
            <span class="text-xs text-slate-500 hidden group-open:inline">ocultar</span>
          </summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th class="text-left py-2 pr-3">Fecha</th>
                  <th class="text-left pr-3">Valor</th>
                  <th class="text-right pr-3">Bruto EUR</th>
                  <th class="text-right pr-3">Retenido EUR</th>
                  <th class="text-left">Tipo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="d in dividends" :key="d.id">
                  <td class="py-2 pr-3 tabular-nums font-mono text-xs text-slate-600">
                    {{ d.date }}
                  </td>
                  <td class="pr-3">
                    <div class="font-mono text-xs">{{ d.instrument.symbol }}</div>
                    <div
                      v-if="d.instrument.name"
                      class="text-xs text-slate-500 truncate max-w-[14rem] sm:max-w-xs"
                      :title="d.instrument.name"
                    >
                      {{ d.instrument.name }}
                    </div>
                    <div
                      v-if="d.instrument.isin"
                      class="text-[10px] text-slate-400 font-mono hidden sm:block"
                    >
                      {{ d.instrument.isin }}
                    </div>
                  </td>
                  <td class="text-right pr-3 tabular-nums">
                    {{ formatEur(d.gross.eur) }}
                  </td>
                  <td class="text-right pr-3 tabular-nums">
                    <template v-if="d.withholdingId">
                      {{ formatEur(withholdingsById.get(d.withholdingId)?.amount.eur ?? 0) }}
                    </template>
                    <span v-else class="text-slate-400">—</span>
                  </td>
                  <td>
                    <span
                      v-if="d.subtype === 'return-of-capital'"
                      class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                      title="Return of Capital: reduce coste de adquisición, no tributa"
                    >
                      ROC
                    </span>
                    <span v-else class="text-xs text-slate-500">ordinario</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
