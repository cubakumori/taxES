<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, CheckCircle2, Circle, Lock } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'

const store = useSessionStore()

/**
 * Handler del `<input type="file">`. Cada slot usa su propio input dentro de
 * un `<label>`: hacer click en cualquier parte del label (botón estilizado)
 * abre el selector nativo, sin depender de `HTMLElement.click()` programático
 * que es frágil entre browsers para inputs ocultos.
 *
 * El parser detecta el tipo del archivo automáticamente por cabecera; aunque
 * el usuario pulse el slot equivocado, el doc acaba en el slot correcto.
 */
function onFilePicked(e: Event): void {
  const target = e.target as HTMLInputElement
  // `target.files` es una FileList viva: resetear `value` antes de leerla la
  // vacía in-place, así que primero copiamos el File y luego limpiamos para
  // permitir re-subir el mismo archivo.
  const file = target.files?.[0] ?? null
  target.value = ''
  if (!file) return
  void store.loadFile(file)
}

// --- Drag & drop ---
//
// Contador de eventos `dragenter`/`dragleave` para evitar el flicker que se
// produce al cruzar elementos hijos (cada hijo dispara enter+leave). Solo
// resaltamos cuando el contador deja el contenedor en 0.
const dragDepth = ref(0)
const dragActive = computed(() => dragDepth.value > 0)

function onDragEnter(e: DragEvent): void {
  // Solo nos interesan drags con archivos.
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragDepth.value += 1
}

function onDragOver(e: DragEvent): void {
  if (!e.dataTransfer?.types.includes('Files')) return
  // preventDefault es lo que habilita drop sobre el elemento.
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(): void {
  if (dragDepth.value > 0) dragDepth.value -= 1
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  dragDepth.value = 0
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  void store.loadFile(file)
}

const hasDividendReport = computed(() => store.dividendDoc !== null)
const hasActivityStatement = computed(() => store.activityDoc !== null)

const dividendFileName = computed(() =>
  hasDividendReport.value && store.lastFileType === 'dividend-report'
    ? store.fileName
    : null,
)
const activityFileName = computed(() =>
  hasActivityStatement.value && store.lastFileType === 'activity-statement'
    ? store.fileName
    : null,
)

const canShowSummary = computed(() => store.summary !== null)
</script>

<template>
  <div class="space-y-4">
    <!-- Cabecera: sesión en curso + botón Ver resumen IRPF cuando aplique -->
    <div
      v-if="store.hasAnyData"
      class="flex items-center justify-between gap-3 flex-wrap"
    >
      <p class="text-sm text-slate-600">
        <span class="font-medium text-slate-900">Sesión en curso</span>
        <template v-if="store.currentTaxYear && store.currentAccountId">
          ·
          <span class="font-mono text-xs"
            >Renta {{ store.currentTaxYear }} · {{ store.currentAccountId }}</span
          >
        </template>
      </p>
      <button
        v-if="canShowSummary"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        @click="store.showSummary"
      >
        Ver resumen IRPF <ArrowRight class="w-4 h-4" />
      </button>
    </div>

    <div
      class="rounded-lg p-4 border transition-colors"
      :class="
        dragActive
          ? 'bg-blue-50 border-blue-400 border-dashed'
          : 'bg-slate-50 border-slate-200'
      "
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <h3 class="text-sm font-medium text-slate-900">Archivos</h3>
      <p class="text-xs text-slate-600 mt-1">
        Sube los CSV de IBKR del mismo ejercicio y cuenta. Pulsa
        <em>Cargar</em> o arrastra el archivo aquí. El tipo se detecta
        automáticamente.
      </p>

      <div class="mt-4 space-y-2">
        <!-- Slot 1: Dividend Report -->
        <div
          class="bg-white border rounded-lg p-3 flex items-start gap-3"
          :class="hasDividendReport ? 'border-emerald-200' : 'border-slate-200'"
        >
          <CheckCircle2
            v-if="hasDividendReport"
            class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
          />
          <Circle v-else class="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <code class="font-mono text-xs font-medium">DividendReport.csv</code>
              <span
                v-if="hasDividendReport"
                class="text-[10px] uppercase tracking-wide text-emerald-700 font-medium"
                >cargado</span
              >
              <span
                v-else
                class="text-[10px] uppercase tracking-wide text-red-700 font-medium"
                >obligatorio para dividendos</span
              >
            </div>
            <p class="text-xs text-slate-600 mt-0.5">
              Dividendos y retenciones al detalle fiscal (ROC incluido). Fuente canónica
              para la Casilla 0029 y la doble imposición.
            </p>
            <p class="text-[11px] text-slate-500 mt-1">
              IBKR Client Portal → Performance &amp; Reports → Reports → Tax → Dividend
              Report (formato CSV).
            </p>
            <p
              v-if="dividendFileName"
              class="text-[11px] text-slate-400 mt-1 font-mono truncate"
            >
              {{ dividendFileName }}
            </p>
          </div>
          <label
            class="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer select-none"
          >
            {{ hasDividendReport ? 'Cambiar' : 'Cargar' }}
            <input
              type="file"
              accept=".csv,text/csv"
              class="sr-only"
              @change="onFilePicked"
            />
          </label>
        </div>

        <!-- Slot 2: Activity Statement -->
        <div
          class="bg-white border rounded-lg p-3 flex items-start gap-3"
          :class="hasActivityStatement ? 'border-emerald-200' : 'border-slate-200'"
        >
          <CheckCircle2
            v-if="hasActivityStatement"
            class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
          />
          <Circle v-else class="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <code class="font-mono text-xs font-medium">Informe de Actividad.csv</code>
              <span
                v-if="hasActivityStatement"
                class="text-[10px] uppercase tracking-wide text-emerald-700 font-medium"
                >cargado</span
              >
              <span
                v-else
                class="text-[10px] uppercase tracking-wide text-amber-700 font-medium"
                >necesario si hubo ventas</span
              >
            </div>
            <p class="text-xs text-slate-600 mt-0.5">
              Trades (compras y ventas), comisiones, movimientos de caja e ISINs.
              Imprescindible para el cálculo FIFO de plusvalías y la validación cruzada.
            </p>
            <p class="text-[11px] text-slate-500 mt-1">
              IBKR Client Portal → Performance &amp; Reports → Reports → Activity →
              ejercicio anual, formato CSV.
            </p>
            <p
              v-if="activityFileName"
              class="text-[11px] text-slate-400 mt-1 font-mono truncate"
            >
              {{ activityFileName }}
            </p>
          </div>
          <label
            class="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 cursor-pointer select-none"
          >
            {{ hasActivityStatement ? 'Cambiar' : 'Cargar' }}
            <input
              type="file"
              accept=".csv,text/csv"
              class="sr-only"
              @change="onFilePicked"
            />
          </label>
        </div>

        <!-- Slot 3: FX Income Worksheet — próximamente -->
        <div
          class="bg-white border border-dashed border-slate-200 rounded-lg p-3 flex items-start gap-3 opacity-70"
        >
          <Lock class="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <code class="font-mono text-xs font-medium">FX Income Worksheet.csv</code>
              <span class="text-[10px] uppercase tracking-wide text-slate-500 font-medium"
                >próximamente</span
              >
            </div>
            <p class="text-xs text-slate-600 mt-0.5">
              Tipo de cambio que IBKR aplicó evento a evento. Opcional; servirá para
              cubrir divisas fuera del BCE y auditar los EUR calculados por la app.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
            disabled
          >
            Cargar
          </button>
        </div>
      </div>

      <p
        v-if="dragActive"
        class="mt-4 text-xs text-blue-700 text-center font-medium pointer-events-none"
      >
        Suelta el archivo para cargarlo
      </p>

      <p
        v-if="store.hasAnyData && !canShowSummary"
        class="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3"
      >
        Hay archivos cargados pero el resumen IRPF aún no tiene contenido
        tributable (sin dividendos ni ventas en el ejercicio). Sube el
        <code class="font-mono bg-white px-1 rounded">DividendReport.csv</code> si hubo
        dividendos, o revisa que el ejercicio del Informe de Actividad sea el correcto.
      </p>

      <p class="mt-4 text-xs text-slate-500">
        El archivo se procesa localmente en tu navegador. No se sube a ningún servidor.
        Otros documentos IBKR (1042-S, NR4, vouchers…) no se suben aquí: se conservan
        como prueba. Detalle en
        <RouterLink to="/preparacion-ibkr" class="text-blue-600 hover:underline"
          >Preparación fiscal (IBKR)</RouterLink
        >.
      </p>
    </div>
  </div>
</template>
