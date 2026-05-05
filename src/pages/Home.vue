<script setup lang="ts">
import { AlertTriangle, ShieldAlert } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import UploadZone from '@components/UploadZone.vue'
import ResultsView from '@components/ResultsView.vue'
import ActivityStatementView from '@components/ActivityStatementView.vue'

const store = useSessionStore()
</script>

<template>
  <div>
    <main class="max-w-5xl mx-auto px-4 pt-8">
      <!-- Loading: hidratando desde IndexedDB -->
      <div v-if="store.status === 'loading'" class="py-24 text-center">
        <div
          class="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>

      <!-- Idle: landing + upload -->
      <div v-else-if="store.status === 'idle'" class="space-y-8">
        <div class="text-center max-w-2xl mx-auto pt-4">
          <h2 class="text-3xl font-bold mb-3">Prepara tu IRPF desde IBKR</h2>
          <p class="text-slate-600">
            Sube el
            <code class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-sm"
              >DividendReport.csv</code
            >
            anual de Interactive Brokers y obtén los importes listos para volcar
            en Renta Web: casilla 0029, deducción por doble imposición, detalle
            por país y avisos de retenciones excesivas.
          </p>
        </div>
        <UploadZone />
      </div>

      <!-- Processing -->
      <div v-else-if="store.status === 'processing'" class="py-24 text-center">
        <div
          class="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"
        ></div>
        <p class="mt-4 text-slate-500">Parseando {{ store.fileName }}…</p>
      </div>

      <!-- Ready: prioriza resumen IRPF si hay DividendReport; si no, muestra Activity Statement -->
      <ResultsView
        v-else-if="store.status === 'ready' && store.summary"
      />
      <ActivityStatementView
        v-else-if="store.status === 'ready' && store.activityDoc"
      />

      <!-- Error -->
      <div
        v-else-if="store.status === 'error'"
        class="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-xl mx-auto"
      >
        <AlertTriangle class="w-8 h-8 text-red-500 mx-auto mb-2" />
        <h3 class="font-medium text-red-900">Error al procesar el archivo</h3>
        <p class="text-sm text-red-700 mt-2">{{ store.errorMessage }}</p>
        <button
          class="mt-4 px-4 py-2 text-sm rounded-lg border border-red-300 bg-white hover:bg-red-100"
          @click="store.reset"
        >
          Volver a intentar
        </button>
      </div>
    </main>

    <!-- Disclaimer común. Siempre visible en la home (incluido estado idle),
         con print:hidden para que no duplique el de las páginas imprimibles. -->
    <div class="max-w-5xl mx-auto px-4 py-6 print:hidden">
      <div
        class="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900"
        role="note"
      >
        <ShieldAlert class="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong class="font-semibold">Esta aplicación no es asesoramiento fiscal.</strong>
          Revisa los importes antes de presentar la declaración y consulta con un asesor
          para casos particulares (participaciones ≥ 10 %, fondos de pensiones, regímenes
          especiales, divisas no publicadas por el BCE, etc.).
        </div>
      </div>
    </div>
  </div>
</template>

