<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { IrpfGainLossRow, IrpfGainLossSummary } from '@lib/rules'
import { getCountryName } from '@lib/rules'
import { formatEur } from '@utils/format'

const props = defineProps<{ plusvalias: IrpfGainLossSummary }>()

const hasIncomplete = computed(() =>
  props.plusvalias.rows.some((r) => r.hasIncompleteBasis),
)

const hasAntiElusion = computed(() =>
  props.plusvalias.rows.some((r) => r.antiElusionFlag),
)

function rowClasses(r: IrpfGainLossRow): string {
  if (r.hasIncompleteBasis) return 'bg-red-50/40'
  if (r.antiElusionFlag) return 'bg-amber-50/40'
  return ''
}

function gainLossClass(amount: number): string {
  if (amount > 0.01) return 'text-emerald-700 font-medium'
  if (amount < -0.01) return 'text-red-700 font-medium'
  return 'text-slate-500'
}

function holdingWindow(r: IrpfGainLossRow): string {
  if (!r.acquisitionFrom || !r.acquisitionTo) return '—'
  if (r.acquisitionFrom === r.acquisitionTo) return r.acquisitionFrom
  return `${r.acquisitionFrom} → ${r.acquisitionTo}`
}
</script>

<template>
  <section class="bg-white rounded-xl border border-slate-200 p-6">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Plusvalías y minusvalías · FIFO
        </h3>
        <p class="text-sm font-medium text-slate-900 mt-1">
          {{ plusvalias.label }}
        </p>
        <p class="text-xs text-slate-500 mt-1">
          {{ plusvalias.casillaNote }}
        </p>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="bg-slate-50 rounded-lg p-4">
        <div class="text-xs text-slate-500 mb-1">Valor de transmisión</div>
        <div class="text-2xl font-semibold tabular-nums">
          {{ formatEur(plusvalias.totalValorTransmisionEur) }}
        </div>
      </div>
      <div class="bg-slate-50 rounded-lg p-4">
        <div class="text-xs text-slate-500 mb-1">Valor de adquisición</div>
        <div class="text-2xl font-semibold tabular-nums">
          {{ formatEur(plusvalias.totalValorAdquisicionEur) }}
        </div>
      </div>
      <div
        class="rounded-lg p-4 border"
        :class="
          plusvalias.netoEur >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        "
      >
        <div
          class="text-xs mb-1 flex items-center gap-1.5"
          :class="plusvalias.netoEur >= 0 ? 'text-emerald-700' : 'text-red-700'"
        >
          <TrendingUp v-if="plusvalias.netoEur >= 0" class="w-3.5 h-3.5" />
          <TrendingDown v-else class="w-3.5 h-3.5" />
          Neto (ganancia − pérdida)
        </div>
        <div
          class="text-2xl font-semibold tabular-nums"
          :class="plusvalias.netoEur >= 0 ? 'text-emerald-900' : 'text-red-900'"
        >
          {{ formatEur(plusvalias.netoEur) }}
        </div>
        <div class="text-xs mt-1 text-slate-600 tabular-nums">
          <span class="text-emerald-700">+{{ formatEur(plusvalias.totalGananciasEur) }}</span>
          <span class="mx-1 text-slate-400">·</span>
          <span class="text-red-700">−{{ formatEur(plusvalias.totalPerdidasEur) }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="hasIncomplete"
      class="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3"
    >
      <AlertTriangle class="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div class="text-sm">
        <div class="font-medium text-red-900">Base de coste incompleta</div>
        <div class="text-red-800 mt-0.5">
          Alguna venta consumió más acciones de las que hay registradas en las sesiones
          cargadas para esta cuenta. El coste faltante se asume como 0 €, lo que
          <strong>infla la ganancia</strong>. Carga extractos de años anteriores o completa
          la base manualmente antes de declarar.
        </div>
      </div>
    </div>

    <div
      v-if="hasAntiElusion"
      class="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3"
    >
      <AlertTriangle class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div class="text-sm">
        <div class="font-medium text-amber-900">Posible regla anti-elusión</div>
        <div class="text-amber-800 mt-0.5">
          En alguna fila marcada con <span class="font-mono">anti-elusión</span> se detectó
          recompra del mismo ISIN en ventana corta (2 meses mercado español, 1 año resto).
          La AEAT difiere esa pérdida hasta que se vendan los títulos recomprados. Esta
          herramienta <strong>no aplica el diferimiento automáticamente</strong>; revísalo con
          un asesor.
        </div>
      </div>
    </div>

    <details class="mt-4 group">
      <summary
        class="cursor-pointer list-none text-xs font-medium text-slate-500 uppercase tracking-wide hover:text-slate-700 select-none flex items-center justify-between"
      >
        <span>Detalle línea a línea ({{ plusvalias.rows.length }})</span>
        <span class="group-open:hidden">mostrar</span>
        <span class="hidden group-open:inline">ocultar</span>
      </summary>

      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
              <th class="text-left py-2 pr-4">Fecha venta</th>
              <th class="text-left pr-4">Valor</th>
              <th class="text-right pr-4">Cantidad</th>
              <th class="text-right pr-4">Valor transmisión</th>
              <th class="text-right pr-4">Valor adquisición</th>
              <th class="text-right pr-4">Resultado</th>
              <th class="text-left hidden md:table-cell">Lotes</th>
              <th class="text-left">Avisos</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="r in plusvalias.rows"
              :key="`${r.saleDate}-${r.symbol}`"
              :class="rowClasses(r)"
            >
              <td class="py-2 pr-4 font-mono text-xs tabular-nums">{{ r.saleDate }}</td>
              <td class="pr-4">
                <div class="font-medium">{{ r.symbol }}</div>
                <div v-if="r.name" class="text-xs text-slate-500 truncate max-w-[14rem]">
                  {{ r.name }}
                </div>
                <div v-if="r.isin" class="text-[10px] text-slate-400 font-mono">
                  {{ r.isin }}
                  <span v-if="r.countryOfIssuer" class="ml-1">
                    · {{ getCountryName(r.countryOfIssuer) }}
                  </span>
                </div>
              </td>
              <td class="text-right pr-4 tabular-nums">{{ r.quantity }}</td>
              <td class="text-right pr-4 tabular-nums">
                {{ formatEur(r.saleProceedsEur) }}
              </td>
              <td class="text-right pr-4 tabular-nums">
                {{ formatEur(r.acquisitionCostEur) }}
              </td>
              <td class="text-right pr-4 tabular-nums" :class="gainLossClass(r.gainLossEur)">
                {{ formatEur(r.gainLossEur) }}
              </td>
              <td class="pr-4 text-xs text-slate-500 font-mono tabular-nums hidden md:table-cell">
                {{ holdingWindow(r) }}
              </td>
              <td class="py-2 whitespace-nowrap text-xs">
                <span
                  v-if="r.hasIncompleteBasis"
                  class="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full mr-1"
                  title="Falta base de coste (no hay compras previas suficientes cargadas)"
                >
                  <AlertTriangle class="w-3 h-3" /> base incompleta
                </span>
                <span
                  v-if="r.antiElusionFlag"
                  class="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full"
                  title="Posible regla anti-elusión: recompra del mismo ISIN en ventana corta"
                >
                  <Info class="w-3 h-3" /> anti-elusión
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <p class="text-xs text-slate-400 mt-4">
      Cálculo FIFO por ISIN agregando los extractos cargados de esta misma cuenta. No
      incluye acciones corporativas (splits, spinoffs, fusiones). Consulta con un asesor
      si tu extracto contiene operaciones especiales.
    </p>
  </section>
</template>
