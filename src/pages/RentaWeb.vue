<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink, Upload } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import { formatEur, formatPct } from '@utils/format'
import { getCountryName } from '@lib/rules'

const store = useSessionStore()
const summary = computed(() => store.summary)
const dti = computed(() => summary.value?.dobleImposicionInternacional)
const plusvalias = computed(() => summary.value?.plusvalias)

const hasForeign = computed(
  () => (dti.value?.rendimientosEur ?? 0) > 0.01,
)
const hasExcess = computed(
  () => (dti.value?.impuestoExcedenteEur ?? 0) > 0.01,
)
const hasPlusvalias = computed(() => plusvalias.value !== undefined)

/** Desglose por país con excedente (útil para saber de qué país hay que reclamar). */
const countriesWithExcess = computed(() => {
  if (!dti.value) return []
  return dti.value.porPais.filter((p) => p.excessEur > 0.01)
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-8">
    <header>
      <h1 class="text-3xl font-bold">Guía Renta Web</h1>
      <p class="mt-2 text-slate-600">
        Paso a paso para volcar los números del resumen IRPF en el formulario
        oficial de la AEAT.
      </p>
    </header>

    <!-- Sin datos -->
    <div
      v-if="!summary"
      class="bg-white rounded-xl border border-slate-200 p-8 text-center"
    >
      <Upload class="w-8 h-8 mx-auto text-slate-400 mb-3" />
      <p class="text-slate-700">
        Aún no has cargado un extracto. Sube primero tu
        <code class="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded"
          >DividendReport.csv</code
        >
        y vuelve aquí para ver la guía con tus cifras concretas.
      </p>
      <RouterLink
        to="/"
        class="mt-4 inline-block text-blue-600 hover:underline"
        >Ir a la página principal →</RouterLink
      >
    </div>

    <template v-else>
      <!-- Enlaces oficiales -->
      <section class="bg-white rounded-xl border border-slate-200 p-6">
        <h2 class="text-lg font-semibold">Enlaces oficiales</h2>
        <p class="text-sm text-slate-500 mt-1">
          Acceso directo a las herramientas y documentos de la Agencia
          Tributaria relevantes para la declaración de dividendos.
        </p>
        <ul class="mt-4 space-y-2 text-sm">
          <li>
            <a
              href="https://sede.agenciatributaria.gob.es/Sede/renta.html"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              Sede AEAT — Renta
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <span class="text-slate-500"> · punto de entrada a Renta Web del ejercicio en campaña.</span>
          </li>
          <li>
            <a
              href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos.html"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              Manual práctico de Renta (AEAT)
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <span class="text-slate-500"> · fuente canónica; se actualiza cada ejercicio.</span>
          </li>
          <li>
            <a
              href="https://www.hacienda.gob.es/es-ES/Normativa%20y%20doctrina/Normativa/CDI/Paginas/CDI.aspx"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              Convenios de doble imposición vigentes (Hacienda)
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <span class="text-slate-500"> · listado de CDI por país, con enlace al BOE.</span>
          </li>
          <li>
            <a
              href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/ZA01.shtml"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              Cita previa AEAT
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <span class="text-slate-500"> · si necesitas asesoramiento presencial o telefónico.</span>
          </li>
        </ul>
      </section>

      <!-- Resumen cabecera -->
      <section
        class="bg-slate-900 text-white rounded-xl p-6"
        aria-label="Resumen del ejercicio"
      >
        <div class="text-xs uppercase tracking-wide text-slate-300">
          Tu IRPF {{ summary.taxYear }}
        </div>
        <div class="mt-1 text-sm text-slate-200">
          Cuenta {{ summary.accountId ?? '(anónima)' }} · período
          {{ summary.period.from }} → {{ summary.period.to }}
        </div>
      </section>

      <!-- Paso 1 -->
      <section class="bg-white rounded-xl border border-slate-200 p-6">
        <div class="flex items-baseline gap-2">
          <span class="text-xs bg-slate-900 text-white px-2 py-0.5 rounded font-mono">Paso 1</span>
          <h2 class="text-lg font-semibold">Rendimientos del capital mobiliario</h2>
        </div>

        <div class="mt-3 text-sm text-slate-600">
          <strong>Dónde encontrarlo en Renta Web</strong>:
        </div>
        <div class="mt-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded p-3">
          Rendimientos del capital mobiliario
          <span class="text-slate-400">→</span>
          Dividendos y demás rendimientos por la participación en fondos propios de entidades
          <span class="text-slate-400">→</span>
          <span class="bg-amber-100 text-amber-800 px-1.5 rounded">Casilla {{ summary.casillaDividendos.casilla }}</span>
        </div>

        <p class="mt-4 text-sm text-slate-700">
          Crea un registro de alta con estos dos valores:
        </p>
        <table class="mt-3 w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-2 pr-4">
                Campo
                <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs"
                  >Ingresos íntegros</span
                >
              </td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(summary.casillaDividendos.ingresosIntegros) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4">
                Campo
                <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs"
                  >Retenciones</span
                >
                <span class="text-xs text-slate-500">(solo España)</span>
              </td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(summary.casillaDividendos.retenciones) }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="mt-4 text-xs text-slate-500">
          El campo «Ingresos íntegros» recoge TODOS los dividendos brutos en
          euros (nacionales y extranjeros). «Retenciones» recoge SOLO las
          practicadas en España; las retenciones extranjeras van en el Paso 2.
        </p>
      </section>

      <!-- Paso 2 -->
      <section
        v-if="hasForeign"
        class="bg-white rounded-xl border border-slate-200 p-6"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-xs bg-slate-900 text-white px-2 py-0.5 rounded font-mono">Paso 2</span>
          <h2 class="text-lg font-semibold">
            Deducción por doble imposición internacional
          </h2>
        </div>

        <div class="mt-3 text-sm text-slate-600">
          <strong>Dónde encontrarlo en Renta Web</strong>:
        </div>
        <div class="mt-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded p-3">
          Deducciones generales
          <span class="text-slate-400">→</span>
          Doble imposición internacional por razón de las rentas obtenidas y gravadas en el extranjero
          <span class="text-slate-400">→</span>
          Rentas incluidas en la base del ahorro
          <span class="text-slate-400">→</span>
          Rendimientos netos del capital mobiliario obtenidos en el extranjero
        </div>

        <p class="mt-4 text-sm text-slate-700">
          Rellena estos dos campos con:
        </p>
        <table class="mt-3 w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-2 pr-4">
                Campo
                <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs"
                  >Rendimientos netos del capital mobiliario en el extranjero</span
                >
              </td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(dti!.rendimientosEur) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4">
                Campo
                <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs"
                  >Impuesto satisfecho en el extranjero</span
                >
              </td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(dti!.impuestoSatisfechoEur) }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="mt-4 text-xs text-slate-500">
          El «Impuesto satisfecho en el extranjero» ya está limitado al tope
          del convenio por país. Lo que te retuvieron por encima del tope no se
          puede introducir aquí.
        </p>
      </section>

      <!-- Paso 3 · Plusvalías (si hay ventas) -->
      <section
        v-if="hasPlusvalias"
        class="bg-white rounded-xl border border-slate-200 p-6"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-xs bg-slate-900 text-white px-2 py-0.5 rounded font-mono">Paso 3</span>
          <h2 class="text-lg font-semibold">
            Ganancias y pérdidas patrimoniales (FIFO)
          </h2>
        </div>

        <div class="mt-3 text-sm text-slate-600">
          <strong>Dónde encontrarlo en Renta Web</strong>:
        </div>
        <div class="mt-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded p-3">
          Ganancias y pérdidas patrimoniales
          <span class="text-slate-400">→</span>
          Derivadas de la transmisión de acciones o participaciones negociadas
          <span class="text-slate-400">→</span>
          Alta de un registro por cada venta (clave 1)
        </div>

        <p class="mt-4 text-sm text-slate-700">
          Totales agregados del ejercicio (suma de todas las ventas FIFO):
        </p>
        <table class="mt-3 w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-2 pr-4">Valor de transmisión total</td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(plusvalias!.totalValorTransmisionEur) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4">Valor de adquisición total</td>
              <td class="text-right tabular-nums font-semibold">
                {{ formatEur(plusvalias!.totalValorAdquisicionEur) }}
              </td>
            </tr>
            <tr>
              <td class="py-2 pr-4">
                Resultado neto
                <span class="text-xs text-slate-500">(ganancia − pérdida)</span>
              </td>
              <td
                class="text-right tabular-nums font-semibold"
                :class="plusvalias!.netoEur >= 0 ? 'text-emerald-700' : 'text-red-700'"
              >
                {{ formatEur(plusvalias!.netoEur) }}
              </td>
            </tr>
          </tbody>
        </table>

        <p class="mt-4 text-xs text-slate-500">
          Renta Web pide dar de alta un registro por cada transmisión; en el
          resumen principal y en la página «Imprimir / PDF» tienes el detalle
          fila a fila (fecha, valor, cantidad, valor de transmisión y de
          adquisición, resultado). Si alguna fila está marcada con
          <strong>base incompleta</strong> o <strong>anti-elusión</strong>,
          revísala antes de declarar.
        </p>
      </section>

      <!-- Paso 4 · si hay excedente -->
      <section
        v-if="hasExcess"
        class="bg-amber-50 border border-amber-200 rounded-xl p-6"
      >
        <div class="flex items-baseline gap-2">
          <span class="text-xs bg-amber-600 text-white px-2 py-0.5 rounded font-mono">Aviso</span>
          <h2 class="text-lg font-semibold text-amber-900">
            Excedente no recuperable vía IRPF
          </h2>
        </div>
        <p class="mt-3 text-sm text-amber-900">
          Algún país emisor te retuvo por encima del límite del convenio con
          España. El exceso no se deduce en IRPF, pero sí se puede reclamar al
          país emisor o al broker.
        </p>
        <div class="mt-3 text-sm font-semibold text-amber-900">
          Total excedente: {{ formatEur(dti!.impuestoExcedenteEur) }}
        </div>
        <ul
          v-if="countriesWithExcess.length > 0"
          class="mt-2 text-sm text-amber-900 space-y-0.5"
        >
          <li v-for="c in countriesWithExcess" :key="c.country">
            <span class="font-mono text-xs mr-2">{{ c.country }}</span>
            {{ getCountryName(c.country) }}:
            <span class="tabular-nums">{{ formatEur(c.excessEur) }}</span>
            — retención {{ formatPct(c.withheldEur / (c.grossEur || 1)) }} vs
            convenio {{ formatPct(c.treatyRate) }}
          </li>
        </ul>
      </section>

      <!-- Notas finales -->
      <section class="bg-white rounded-xl border border-slate-200 p-6">
        <h2 class="text-lg font-semibold">Recuerda</h2>
        <ul class="mt-3 text-sm text-slate-700 space-y-2 list-disc pl-5">
          <li>
            <strong>Criterio de caja</strong>: los dividendos se declaran en el
            año en que se cobran, no cuando se devengan.
          </li>
          <li>
            <strong>Dividendos en enero próximo</strong>: si tu DividendReport
            incluye pagos con fecha del año siguiente (el <em>pay date</em>
            cayó en enero), esos irán al IRPF del año siguiente.
          </li>
          <li>
            <strong>W-8BEN vigente</strong> es imprescindible para USA: sin él,
            la retención sube al 30 % y el 15 % extra no se recupera.
          </li>
          <li>
            <strong>Return of Capital (ROC)</strong> no tributa como
            rendimiento (excluido del Paso 1). Además reduce el coste de
            adquisición del ISIN; el motor FIFO lo aplica automáticamente al
            calcular plusvalías.
          </li>
          <li>
            <strong>FIFO multi-año</strong>: para que el Paso 3 sea correcto,
            asegúrate de haber cargado los extractos de los años en que
            compraste los valores que vendiste este ejercicio. Si alguna fila
            sale marcada con «base incompleta», aún te falta un año en tu
            histórico.
          </li>
        </ul>
        <p class="mt-4 text-xs text-slate-500">
          Esta guía es orientativa. Revisa siempre el
          <a
            href="https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos.html"
            target="_blank"
            rel="noopener"
            class="text-blue-600 hover:underline"
            >Manual práctico de Renta</a
          >
          del ejercicio vigente. Esta aplicación no es asesoramiento fiscal.
        </p>
      </section>
    </template>
  </div>
</template>
