<script setup lang="ts">
import { Check, Info, X } from 'lucide-vue-next'
import type { CrossValidationReport } from '@lib/parser'
import { formatEur } from '@utils/format'

defineProps<{ report: CrossValidationReport }>()
</script>

<template>
  <section
    v-if="report.available"
    class="rounded-xl p-6"
    :class="
      report.overallMatch
        ? 'bg-emerald-50 border border-emerald-200'
        : 'bg-amber-50 border border-amber-200'
    "
  >
    <div class="flex items-start gap-3">
      <Check
        v-if="report.overallMatch"
        class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
      />
      <X v-else class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <h3
          class="text-xs font-medium uppercase tracking-wide"
          :class="report.overallMatch ? 'text-emerald-700' : 'text-amber-700'"
        >
          Validación cruzada · DividendReport ↔ Informe de Actividad
        </h3>
        <p
          class="text-sm mt-1"
          :class="report.overallMatch ? 'text-emerald-900' : 'text-amber-900'"
        >
          <template v-if="report.overallMatch">
            Los totales reportados por ambos informes cuadran dentro de ±{{
              formatEur(report.threshold)
            }}.
          </template>
          <template v-else>
            Los totales reportados por ambos informes difieren más del umbral
            tolerado (±{{ formatEur(report.threshold) }}). No suele ser un error
            del parser sino de cómo cada informe redondea o agrupa; revisa si te
            importa.
          </template>
        </p>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-xs uppercase border-b"
                :class="
                  report.overallMatch
                    ? 'text-emerald-700 border-emerald-200'
                    : 'text-amber-700 border-amber-200'
                "
              >
                <th class="text-left py-2 pr-4">Métrica</th>
                <th class="text-right pr-4">DividendReport</th>
                <th class="text-right pr-4">Informe de Actividad</th>
                <th class="text-right pr-4">Diferencia</th>
                <th class="text-center">Cuadra</th>
              </tr>
            </thead>
            <tbody
              class="divide-y"
              :class="report.overallMatch ? 'divide-emerald-100' : 'divide-amber-100'"
            >
              <tr>
                <td class="py-2 pr-4">Dividendos brutos (EUR)</td>
                <td class="text-right pr-4 tabular-nums">
                  {{ formatEur(report.dividendGrossEur.dividendReport ?? 0) }}
                </td>
                <td class="text-right pr-4 tabular-nums">
                  {{ formatEur(report.dividendGrossEur.activityStatement ?? 0) }}
                </td>
                <td
                  class="text-right pr-4 tabular-nums"
                  :class="
                    report.dividendGrossEur.match
                      ? 'text-slate-500'
                      : 'text-amber-700 font-medium'
                  "
                >
                  {{ formatEur(report.dividendGrossEur.diff) }}
                </td>
                <td class="text-center">
                  <Check
                    v-if="report.dividendGrossEur.match"
                    class="w-4 h-4 text-emerald-600 inline"
                  />
                  <X v-else class="w-4 h-4 text-amber-600 inline" />
                </td>
              </tr>
              <tr>
                <td class="py-2 pr-4">Retenciones totales (EUR)</td>
                <td class="text-right pr-4 tabular-nums">
                  {{ formatEur(report.withholdingEur.dividendReport ?? 0) }}
                </td>
                <td class="text-right pr-4 tabular-nums">
                  {{ formatEur(report.withholdingEur.activityStatement ?? 0) }}
                </td>
                <td
                  class="text-right pr-4 tabular-nums"
                  :class="
                    report.withholdingEur.match
                      ? 'text-slate-500'
                      : 'text-amber-700 font-medium'
                  "
                >
                  {{ formatEur(report.withholdingEur.diff) }}
                </td>
                <td class="text-center">
                  <Check
                    v-if="report.withholdingEur.match"
                    class="w-4 h-4 text-emerald-600 inline"
                  />
                  <X v-else class="w-4 h-4 text-amber-600 inline" />
                </td>
              </tr>
              <tr class="text-slate-600">
                <td class="py-2 pr-4">Nº de dividendos</td>
                <td class="text-right pr-4 tabular-nums">
                  {{ report.dividendCount.dividendReport ?? 0 }}
                </td>
                <td class="text-right pr-4 tabular-nums">
                  {{ report.dividendCount.activityStatement ?? 0 }}
                </td>
                <td class="text-right pr-4 tabular-nums text-slate-500">
                  {{ report.dividendCount.diff > 0 ? '+' : '' }}{{ report.dividendCount.diff }}
                </td>
                <td class="text-center">
                  <Info
                    class="w-4 h-4 text-slate-400 inline"
                    title="Conteo solo informativo: el DividendReport divide cada dividendo con componente ROC parcial en dos eventos separados (parte 'cash' + parte 'return-of-capital'), mientras que el Informe de Actividad lista una sola línea por pago. Los totales sí se validan."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
