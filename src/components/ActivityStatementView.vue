<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeft,
  Download,
  Info,
  Plus,
  TrendingUp,
} from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import { formatEur } from '@utils/format'
import type {
  CashTransactionEvent,
  FeeEvent,
  StatementEvent,
  TradeEvent,
} from '@lib/parser'

const store = useSessionStore()
const doc = computed(() => store.activityDoc!)

const isTrade = (e: StatementEvent): e is TradeEvent => e.kind === 'trade'
const isFee = (e: StatementEvent): e is FeeEvent => e.kind === 'fee'
const isCash = (e: StatementEvent): e is CashTransactionEvent =>
  e.kind === 'cash-transaction'

const trades = computed(() => doc.value.events.filter(isTrade))
const fees = computed(() => doc.value.events.filter(isFee))
const cash = computed(() => doc.value.events.filter(isCash))

const tradesByCurrency = computed(() => {
  const map = new Map<string, { count: number; buy: number; sell: number }>()
  for (const t of trades.value) {
    const r = map.get(t.gross.currency) ?? { count: 0, buy: 0, sell: 0 }
    r.count += 1
    if (t.side === 'buy') r.buy += t.gross.amount
    else r.sell += t.gross.amount
    map.set(t.gross.currency, r)
  }
  return [...map.entries()].sort()
})

const feesByType = computed(() => {
  const map = new Map<string, { count: number; eur: number }>()
  for (const f of fees.value) {
    const r = map.get(f.feeType) ?? { count: 0, eur: 0 }
    r.count += 1
    r.eur += f.amount.eur
    map.set(f.feeType, r)
  }
  return [...map.entries()].sort()
})

const cashTotals = computed(() => {
  const deposits = cash.value
    .filter((c) => c.txType === 'deposit')
    .reduce((s, c) => s + c.amount.eur, 0)
  const withdrawals = cash.value
    .filter((c) => c.txType === 'withdrawal')
    .reduce((s, c) => s + c.amount.eur, 0)
  return { deposits, withdrawals }
})

const warningsByCode = computed(() => {
  const map = new Map<string, number>()
  for (const w of doc.value.warnings) {
    map.set(w.code, (map.get(w.code) ?? 0) + 1)
  }
  return [...map.entries()].sort()
})

function downloadJson(): void {
  const data = JSON.stringify(doc.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `activity-${doc.value.taxYear}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold">
          Informe de Actividad {{ doc.taxYear }}
        </h2>
        <p class="text-sm text-slate-500 mt-1">
          Cuenta {{ doc.accountInfo.accountId ?? '(anónima)' }} ·
          {{ doc.accountInfo.baseCurrency }} ·
          {{ doc.accountInfo.periodFrom }} → {{ doc.accountInfo.periodTo }}
        </p>
        <p v-if="store.fileName" class="text-xs text-slate-400 mt-0.5 font-mono">
          {{ store.fileName }}
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
          @click="downloadJson"
        >
          <Download class="w-4 h-4" /> JSON
        </button>
        <button
          class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
          @click="store.backToUpload"
        >
          <Plus class="w-4 h-4" /> Añadir archivo
        </button>
        <button
          class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
          @click="store.reset"
        >
          <ArrowLeft class="w-4 h-4" /> Empezar de cero
        </button>
      </div>
    </div>

    <!-- Banner: falta DividendReport para el resumen fiscal -->
    <div
      v-if="!store.summary"
      class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3"
    >
      <Info class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      <div class="text-sm text-blue-900">
        Este archivo es el <strong>Informe de Actividad</strong>: contiene
        trades, comisiones y movimientos de caja, pero no da el resumen fiscal.
        Para obtener la
        <strong>Casilla 0029</strong> y la deducción por doble imposición, sube
        también tu
        <code class="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-xs"
          >DividendReport.csv</code
        >
        usando «Añadir archivo».
      </div>
    </div>

    <!-- Trades -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
        <TrendingUp class="w-4 h-4" />
        Operaciones (trades) · {{ trades.length }}
      </h3>
      <div v-if="trades.length === 0" class="mt-4 text-sm text-slate-500">
        Sin operaciones en el ejercicio.
      </div>
      <div v-else class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
              <th class="text-left py-2 pr-4">Divisa</th>
              <th class="text-right pr-4">Ops</th>
              <th class="text-right pr-4">Total compras</th>
              <th class="text-right">Total ventas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="[ccy, r] in tradesByCurrency" :key="ccy">
              <td class="py-2 pr-4 font-mono">{{ ccy }}</td>
              <td class="text-right pr-4 tabular-nums">{{ r.count }}</td>
              <td class="text-right pr-4 tabular-nums">
                {{ r.buy.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="text-right tabular-nums">
                {{ r.sell.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs text-slate-500 mt-3">
          Importes en divisa original. La conversión a EUR requiere tipos de
          cambio BCE del día del evento (pendiente de implementar).
        </p>
      </div>
    </section>

    <!-- Fees -->
    <section v-if="fees.length > 0" class="bg-white rounded-xl border border-slate-200 p-6">
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Tarifas y comisiones · {{ fees.length }}
      </h3>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
              <th class="text-left py-2 pr-4">Tipo</th>
              <th class="text-right pr-4">#</th>
              <th class="text-right">Total (EUR)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="[type, r] in feesByType" :key="type">
              <td class="py-2 pr-4">{{ type }}</td>
              <td class="text-right pr-4 tabular-nums">{{ r.count }}</td>
              <td class="text-right tabular-nums">{{ formatEur(r.eur) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Cash -->
    <section
      v-if="cash.length > 0"
      class="bg-white rounded-xl border border-slate-200 p-6"
    >
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Movimientos de caja · {{ cash.length }}
      </h3>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">Depósitos (EUR)</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(cashTotals.deposits) }}
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">Retiradas (EUR)</div>
          <div class="text-2xl font-semibold tabular-nums">
            {{ formatEur(cashTotals.withdrawals) }}
          </div>
        </div>
      </div>
    </section>

    <!-- Warnings (agrupados por código) -->
    <section
      v-if="doc.warnings.length > 0"
      class="bg-white rounded-xl border border-slate-200 p-6"
    >
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Avisos del parser · {{ doc.warnings.length }}
      </h3>
      <ul class="mt-3 text-sm text-slate-700 space-y-1">
        <li v-for="[code, n] in warningsByCode" :key="code">
          <span class="font-mono text-xs text-slate-500 mr-2">[{{ n }}×]</span>
          {{ code }}
        </li>
      </ul>
    </section>

    <!-- Disclaimer -->
    <p class="text-xs text-slate-500 text-center pt-2">
      Esta aplicación no es asesoramiento fiscal. Revisa los importes antes de
      presentar la declaración y consulta con un asesor para casos particulares.
    </p>
  </div>
</template>
