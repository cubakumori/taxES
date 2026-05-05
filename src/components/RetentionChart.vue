<script setup lang="ts">
import { computed } from 'vue'
import { getCountryName, type IrpfCountrySummary } from '@lib/rules'
import { formatEur } from '@utils/format'

const props = defineProps<{ rows: IrpfCountrySummary[] }>()

/** Escala del eje X: 40 % cubre holgadamente los casos habituales. */
const MAX_SCALE = 40
/** Umbral (en puntos porcentuales) para mostrar la etiqueta de excedente dentro del ámbar. */
const EXCESS_LABEL_MIN_WIDTH = 5

interface ChartRow {
  country: string
  grossEur: number
  rate: number // %
  treatyPct: number // %
  hasTreaty: boolean
  exceeds: boolean
  excess: number // EUR
}

const chartRows = computed<ChartRow[]>(() => {
  const out = props.rows
    .filter((r) => r.grossEur > 0.01)
    .map<ChartRow>((r) => ({
      country: r.country,
      grossEur: r.grossEur,
      rate: r.grossEur > 0 ? (r.withheldEur / r.grossEur) * 100 : 0,
      treatyPct: r.treatyRate * 100,
      hasTreaty: r.hasTreaty,
      exceeds: r.excessEur > 0.01,
      excess: r.excessEur,
    }))
  out.sort((a, b) => {
    if (a.exceeds !== b.exceeds) return a.exceeds ? -1 : 1
    if (a.exceeds) return b.excess - a.excess
    return b.rate - a.rate
  })
  return out
})

function widthPct(valuePct: number): string {
  return `${(Math.min(Math.max(valuePct, 0), MAX_SCALE) / MAX_SCALE) * 100}%`
}
</script>

<template>
  <details class="bg-white rounded-xl border border-slate-200 group">
    <summary
      class="cursor-pointer list-none p-6 flex items-center justify-between gap-4 hover:bg-slate-50 rounded-xl transition-colors"
    >
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Tipo efectivo de retención por país
      </h3>
      <span class="text-xs text-slate-500 shrink-0 group-open:hidden">mostrar</span>
      <span class="text-xs text-slate-500 shrink-0 hidden group-open:inline">ocultar</span>
    </summary>
    <div class="px-6 pb-6">
      <p class="text-xs sm:text-sm text-slate-600">
        Porcentaje retenido en origen sobre el bruto. El segmento
        <span class="inline-block w-3 h-3 bg-emerald-300 rounded-sm align-middle" />
        verde está dentro del convenio (recuperable); el
        <span class="inline-block w-3 h-3 bg-amber-400 rounded-sm align-middle" />
        ámbar excede el convenio y no se recupera vía IRPF. La marca vertical
        señala el tope del convenio con España.
      </p>

      <div class="mt-5 space-y-2">
        <div
          v-for="row in chartRows"
          :key="row.country"
          class="flex items-center gap-2 sm:gap-3 text-sm"
        >
          <div
            class="w-24 sm:w-44 shrink-0 truncate text-xs sm:text-sm"
            :title="getCountryName(row.country)"
          >
            <span class="font-mono text-[10px] sm:text-xs text-slate-500 mr-1.5 sm:mr-2">{{ row.country }}</span>
            <span class="text-slate-700">{{ getCountryName(row.country) }}</span>
          </div>

          <div class="flex-1 relative h-6 min-w-0">
            <!-- Barra visual: capa recortada con colores -->
            <div class="absolute inset-0 bg-slate-100 rounded overflow-hidden">
              <!-- Segmento recuperable (dentro del convenio) -->
              <div
                class="absolute left-0 top-0 h-full bg-emerald-300"
                :style="{ width: widthPct(Math.min(row.rate, row.treatyPct)) }"
              />
              <!-- Segmento excedente (fuera del convenio) -->
              <div
                v-if="row.exceeds"
                class="absolute top-0 h-full bg-amber-400"
                :style="{
                  left: widthPct(row.treatyPct),
                  width: widthPct(Math.max(0, row.rate - row.treatyPct)),
                }"
              />
              <!-- Marca vertical del tope del convenio -->
              <div
                v-if="row.hasTreaty && row.treatyPct > 0 && row.treatyPct < MAX_SCALE"
                class="absolute top-0 h-full w-[2px] bg-slate-700"
                :style="{ left: widthPct(row.treatyPct) }"
              />
            </div>

            <!-- Etiqueta del excedente: centrada dentro del ámbar SI cabe (≥ 5 pp) -->
            <div
              v-if="row.exceeds && row.rate - row.treatyPct >= EXCESS_LABEL_MIN_WIDTH"
              class="absolute top-0 h-full flex items-center justify-center text-[10px] font-semibold text-amber-900 whitespace-nowrap pointer-events-none"
              :style="{
                left: widthPct(row.treatyPct),
                width: widthPct(Math.max(0, row.rate - row.treatyPct)),
              }"
            >
              −{{ formatEur(row.excess) }}
            </div>
            <!-- Etiquetas tras el fill: si el excedente NO cupo dentro del ámbar, se muestra aquí a la izquierda del % -->
            <div
              class="absolute top-0 h-full flex items-center pl-1.5 gap-1.5 whitespace-nowrap pointer-events-none"
              :style="{ left: widthPct(row.rate) }"
            >
              <span
                v-if="row.exceeds && row.rate - row.treatyPct < EXCESS_LABEL_MIN_WIDTH"
                class="text-[10px] font-semibold text-amber-700"
              >
                −{{ formatEur(row.excess) }}
              </span>
              <span class="text-[10px] sm:text-xs font-semibold text-slate-800">
                {{ row.rate.toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
