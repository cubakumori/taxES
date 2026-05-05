<script setup lang="ts">
import type { IbkrEquivalenceView, IrpfSummary } from '@lib/rules'
import { formatEur } from '@utils/format'

defineProps<{
  equivalence: IbkrEquivalenceView
  summary: IrpfSummary
}>()
</script>

<template>
  <details class="bg-white rounded-xl border border-slate-200 group">
    <summary
      class="cursor-pointer list-none p-6 flex items-center justify-between gap-4 hover:bg-slate-50 rounded-xl transition-colors"
    >
      <div>
        <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Verificación
        </h3>
        <p class="text-sm font-medium text-slate-900 mt-1">
          Equivalencia con el «Dividend Revenue Summary» de IBKR
        </p>
      </div>
      <span class="text-xs text-slate-500 shrink-0 group-open:hidden">mostrar</span>
      <span class="text-xs text-slate-500 shrink-0 hidden group-open:inline">ocultar</span>
    </summary>
    <div class="px-6 pb-6 space-y-5">
      <p class="text-xs text-slate-500">
        Los mismos totales en los ejes que usa IBKR (US / Non-US, todo el
        extracto). Úsalos para contrastar al céntimo con el bloque
        <em>Dividend Revenue Summary</em> de tu
        <code class="font-mono">DividendReport.html</code>.
      </p>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-2 pr-4 text-slate-700">Total Ordinary Dividends</td>
              <td class="text-right tabular-nums font-medium">
                {{ formatEur(equivalence.totalOrdinaryDividends) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 text-slate-700">
                Total non-US Ordinary Dividends
              </td>
              <td class="text-right tabular-nums font-medium">
                {{ formatEur(equivalence.totalNonUsOrdinaryDividends) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 text-slate-700">US Tax Paid</td>
              <td class="text-right tabular-nums font-medium">
                {{ formatEur(equivalence.usTaxPaid) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 text-slate-700">Non-US Tax Paid</td>
              <td class="text-right tabular-nums font-medium">
                {{ formatEur(equivalence.nonUsTaxPaid) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4 text-slate-700">
                Return of Capital Distributions
              </td>
              <td class="text-right tabular-nums font-medium">
                {{ formatEur(equivalence.returnOfCapital) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Reconciliación hacia IRPF -->
      <div class="bg-slate-50 rounded-lg p-4">
        <div class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
          Reconciliación con tu IRPF {{ summary.taxYear }} (criterio de caja)
        </div>
        <ul class="text-sm space-y-2">
          <li class="flex flex-wrap items-baseline gap-x-2">
            <span class="tabular-nums">
              {{ formatEur(equivalence.totalOrdinaryDividends) }}
            </span>
            <span class="text-slate-500">−</span>
            <span class="tabular-nums">
              {{ formatEur(equivalence.excludedOutOfYearDividendGross) }}
            </span>
            <span class="text-slate-500 text-xs">
              (cobros fuera del {{ summary.taxYear }})
            </span>
            <span class="text-slate-500">=</span>
            <span class="tabular-nums font-semibold">
              {{ formatEur(summary.casillaDividendos.ingresosIntegros) }}
            </span>
            <span class="text-xs text-slate-600">
              → Casilla 0029 · Ingresos íntegros
            </span>
          </li>
          <li class="flex flex-wrap items-baseline gap-x-2">
            <span class="tabular-nums">
              {{ formatEur(equivalence.usTaxPaid) }}
            </span>
            <span class="text-slate-500">−</span>
            <span class="tabular-nums">
              {{ formatEur(equivalence.excludedOutOfYearUsTaxPaid) }}
            </span>
            <span class="text-slate-500 text-xs">
              (US fuera del {{ summary.taxYear }})
            </span>
            <span class="text-slate-500">=</span>
            <span class="tabular-nums font-semibold">
              {{
                formatEur(
                  equivalence.usTaxPaid - equivalence.excludedOutOfYearUsTaxPaid,
                )
              }}
            </span>
            <span class="text-xs text-slate-600">→ deducible fila US</span>
          </li>
          <li class="flex flex-wrap items-baseline gap-x-2">
            <span class="tabular-nums">
              {{ formatEur(equivalence.nonUsTaxPaid) }}
            </span>
            <span class="text-slate-500">=</span>
            <span class="tabular-nums">
              {{ formatEur(summary.casillaDividendos.retenciones) }}
            </span>
            <span class="text-xs text-slate-500">(España, casilla 0029)</span>
            <span class="text-slate-500">+</span>
            <span class="tabular-nums font-semibold">
              {{
                formatEur(
                  equivalence.nonUsTaxPaid -
                    summary.casillaDividendos.retenciones -
                    equivalence.excludedOutOfYearNonUsTaxPaid,
                )
              }}
            </span>
            <span class="text-xs text-slate-500">
              (resto foreign, deducción doble imposición)
            </span>
          </li>
          <li class="flex flex-wrap items-baseline gap-x-2">
            <span class="tabular-nums">
              {{ formatEur(equivalence.returnOfCapital) }}
            </span>
            <span class="text-xs text-slate-600">
              → Return of Capital: no tributa como rendimiento; reduce el coste
              de adquisición en futuras ventas.
            </span>
          </li>
        </ul>
      </div>
    </div>
  </details>
</template>
