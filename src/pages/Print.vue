<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Printer } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import { formatEur, formatPct } from '@utils/format'
import { getCountryName } from '@lib/rules'

const store = useSessionStore()

const summary = computed(() => store.summary)
const dti = computed(() => summary.value?.dobleImposicionInternacional)
const plusvalias = computed(() => summary.value?.plusvalias)

const today = computed(() => {
  return new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
})

/** Ordenamos el desglose por bruto desc para que lo relevante salga arriba. */
const sortedCountryRows = computed(() => {
  if (!dti.value) return []
  return [...dti.value.porPais].sort((a, b) => b.grossEur - a.grossEur)
})

/** Solo errores y avisos warn para impresión; los info se omiten para ahorrar espacio. */
const printWarnings = computed(() => {
  if (!summary.value) return []
  return summary.value.avisos.filter(
    (a) => a.severity === 'error' || a.severity === 'warn',
  )
})

function doPrint(): void {
  window.print()
}
</script>

<template>
  <div class="print-page">
    <!-- Controles (solo pantalla) -->
    <div class="print:hidden flex justify-between items-center mb-6 max-w-3xl mx-auto px-4 pt-6">
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2"
        @click="$router.back()"
      >
        <ArrowLeft class="w-4 h-4" /> Volver
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"
        @click="doPrint"
      >
        <Printer class="w-4 h-4" /> Imprimir / Guardar PDF
      </button>
    </div>

    <!-- Sin datos -->
    <div
      v-if="!summary"
      class="print:hidden max-w-3xl mx-auto px-4 py-12 text-center text-slate-600"
    >
      <p>No hay un resumen IRPF cargado todavía.</p>
      <RouterLink to="/" class="text-blue-600 hover:underline mt-3 inline-block">
        Ir a la página principal
      </RouterLink>
    </div>

    <!-- Hoja imprimible -->
    <article v-else class="sheet">
      <header class="sheet-header">
        <h1>IRPF {{ summary.taxYear }} — Resumen para Renta Web</h1>
        <p class="meta">
          Cuenta {{ summary.accountId ?? '(anónima)' }}
          · {{ summary.baseCurrency }}
          · período {{ summary.period.from }} → {{ summary.period.to }}
        </p>
        <p class="meta small">
          Generado el {{ today }} · taxES · motor {{ summary.motorReglasVersion }}
        </p>
      </header>

      <!-- Casilla 0029 -->
      <section>
        <h2>Rendimientos del capital mobiliario (base del ahorro)</h2>
        <div class="casilla-label">
          <span class="casilla-tag">Casilla {{ summary.casillaDividendos.casilla }}</span>
          <span>{{ summary.casillaDividendos.label }}</span>
        </div>
        <table class="kv">
          <tbody>
            <tr>
              <th>Ingresos íntegros</th>
              <td class="num">
                {{ formatEur(summary.casillaDividendos.ingresosIntegros) }}
              </td>
            </tr>
            <tr>
              <th>Retenciones (España)</th>
              <td class="num">
                {{ formatEur(summary.casillaDividendos.retenciones) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Doble imposición -->
      <section v-if="dti">
        <h2>Deducción por doble imposición internacional (base del ahorro)</h2>
        <table class="kv">
          <tbody>
            <tr>
              <th>Rendimientos del capital mobiliario obtenidos en el extranjero</th>
              <td class="num">{{ formatEur(dti.rendimientosEur) }}</td>
            </tr>
            <tr>
              <th>Impuesto satisfecho en el extranjero (deducible)</th>
              <td class="num">{{ formatEur(dti.impuestoSatisfechoEur) }}</td>
            </tr>
            <tr v-if="dti.impuestoExcedenteEur > 0.01" class="highlight">
              <th>Excedente no recuperable vía IRPF</th>
              <td class="num">{{ formatEur(dti.impuestoExcedenteEur) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Desglose por país -->
      <section v-if="sortedCountryRows.length > 0" class="avoid-break">
        <h2>Desglose por país</h2>
        <table class="grid">
          <thead>
            <tr>
              <th class="t-left">País</th>
              <th class="t-right">#Div</th>
              <th class="t-right">Bruto EUR</th>
              <th class="t-right">Retenido EUR</th>
              <th class="t-right">Convenio</th>
              <th class="t-right">Deducible EUR</th>
              <th class="t-right">Excedente EUR</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedCountryRows" :key="row.country">
              <td>
                <span class="mono small">{{ row.country }}</span>
                {{ getCountryName(row.country) }}
              </td>
              <td class="t-right num">{{ row.dividendCount }}</td>
              <td class="t-right num">{{ formatEur(row.grossEur) }}</td>
              <td class="t-right num">{{ formatEur(row.withheldEur) }}</td>
              <td class="t-right num">
                <template v-if="row.hasTreaty">{{ formatPct(row.treatyRate) }}</template>
                <template v-else>sin conv.</template>
              </td>
              <td class="t-right num">{{ formatEur(row.deductibleEur) }}</td>
              <td class="t-right num">{{ formatEur(row.excessEur) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Plusvalías (FIFO) -->
      <section v-if="plusvalias" class="avoid-break">
        <h2>Ganancias y pérdidas patrimoniales (FIFO)</h2>
        <p class="meta small" style="margin-bottom: 0.5rem;">
          {{ plusvalias.casillaNote }}
        </p>
        <table class="kv">
          <tbody>
            <tr>
              <th>Valor de transmisión (total)</th>
              <td class="num">{{ formatEur(plusvalias.totalValorTransmisionEur) }}</td>
            </tr>
            <tr>
              <th>Valor de adquisición (total)</th>
              <td class="num">{{ formatEur(plusvalias.totalValorAdquisicionEur) }}</td>
            </tr>
            <tr>
              <th>Ganancias brutas</th>
              <td class="num">{{ formatEur(plusvalias.totalGananciasEur) }}</td>
            </tr>
            <tr>
              <th>Pérdidas brutas</th>
              <td class="num">{{ formatEur(plusvalias.totalPerdidasEur) }}</td>
            </tr>
            <tr class="highlight">
              <th>Resultado neto</th>
              <td class="num">{{ formatEur(plusvalias.netoEur) }}</td>
            </tr>
          </tbody>
        </table>

        <table class="grid" style="margin-top: 0.75rem;">
          <thead>
            <tr>
              <th class="t-left">Fecha</th>
              <th class="t-left">Valor</th>
              <th class="t-right">Cant.</th>
              <th class="t-right">V. transm.</th>
              <th class="t-right">V. adquis.</th>
              <th class="t-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in plusvalias.rows" :key="`${r.saleDate}-${r.symbol}`">
              <td class="mono small">{{ r.saleDate }}</td>
              <td>
                {{ r.symbol }}
                <span v-if="r.isin" class="mono small">· {{ r.isin }}</span>
              </td>
              <td class="t-right num">{{ r.quantity }}</td>
              <td class="t-right num">{{ formatEur(r.saleProceedsEur) }}</td>
              <td class="t-right num">{{ formatEur(r.acquisitionCostEur) }}</td>
              <td class="t-right num">{{ formatEur(r.gainLossEur) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Avisos (solo errores y warns) -->
      <section v-if="printWarnings.length > 0" class="avoid-break">
        <h2>Avisos</h2>
        <ul class="notices">
          <li v-for="(a, i) in printWarnings" :key="i">
            <span class="sev" :class="`sev-${a.severity}`">
              {{ a.severity === 'error' ? '[ERROR]' : '[AVISO]' }}
            </span>
            {{ a.message }}
          </li>
        </ul>
      </section>

      <footer class="sheet-footer">
        <p>
          Esta aplicación no es asesoramiento fiscal. Revisa los importes antes
          de presentar la declaración y consulta con un asesor para casos
          particulares. Los datos proceden del extracto de Interactive Brokers.
        </p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
/* Pantalla: layout centrado legible */
.sheet {
  max-width: 48rem;
  margin: 0 auto 4rem;
  padding: 2.5rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, sans-serif;
  line-height: 1.5;
}
.sheet-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}
.meta {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
}
.meta.small {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
.sheet section {
  margin-top: 1.75rem;
}
.sheet h2 {
  font-size: 1.05rem;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.3rem;
  margin: 0 0 0.75rem;
}
.casilla-label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
  font-size: 0.875rem;
  color: #475569;
}
.casilla-tag {
  background: #0f172a;
  color: white;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
}
.kv {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}
.kv th {
  font-weight: 400;
  color: #334155;
  text-align: left;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.kv td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.kv tr.highlight th,
.kv tr.highlight td {
  background: #fffbeb;
  color: #78350f;
}
.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.grid thead th {
  font-weight: 600;
  background: #f8fafc;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #cbd5e1;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
}
.grid tbody td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.t-left { text-align: left; }
.t-right { text-align: right; }
.num { font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, SFMono-Regular, monospace; color: #64748b; margin-right: 0.4rem; }
.small { font-size: 0.7rem; }
.notices {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.85rem;
}
.notices li {
  padding: 0.35rem 0;
  border-bottom: 1px solid #f1f5f9;
}
.sev {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  margin-right: 0.4rem;
  font-weight: 600;
}
.sev-error { color: #b91c1c; }
.sev-warn { color: #b45309; }
.sheet-footer {
  margin-top: 2.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.72rem;
  color: #64748b;
}

/* Impresión */
@media print {
  .sheet {
    max-width: none;
    margin: 0;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
  }
  .sheet-header h1 { font-size: 1.2rem; }
  .sheet section { margin-top: 1rem; }
  .sheet h2 { font-size: 0.95rem; }
  .kv, .grid { font-size: 0.78rem; }
  .avoid-break { break-inside: avoid; }
  /* Fondo amarillo del highlight se pierde al imprimir por defecto;
     forzamos la impresión de backgrounds. */
  .kv tr.highlight th,
  .kv tr.highlight td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
