<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import {
  getCountryName,
  TREATY_RATES_IRPF_2025,
  type TreatyInfo,
} from '@lib/rules'

interface Section {
  id: string
  title: string
}
interface SectionGroup {
  title: string
  sections: Section[]
}

const groups: SectionGroup[] = [
  {
    title: 'Conceptos básicos',
    sections: [
      { id: 'base-ahorro', title: 'Base del ahorro' },
      { id: 'dividendos', title: 'Dividendos: bruto, neto, retención' },
      { id: 'divisas', title: 'Divisas y tipo de cambio' },
    ],
  },
  {
    title: 'Doble imposición',
    sections: [
      { id: 'doble-imposicion', title: 'Doble imposición internacional' },
      { id: 'convenios', title: 'Convenios de doble imposición' },
      { id: 'w8ben', title: 'W-8BEN: retención USA' },
    ],
  },
  {
    title: 'Casos especiales',
    sections: [
      { id: 'roc', title: 'Return of Capital (ROC)' },
      { id: 'fifo', title: 'FIFO y plusvalías' },
    ],
  },
  {
    title: 'Práctica',
    sections: [
      { id: 'extracto-ibkr', title: 'El extracto de IBKR' },
      { id: 'errores-comunes', title: 'Errores comunes' },
    ],
  },
]

interface TreatyRow extends TreatyInfo {
  code: string
  name: string
}

const treatyCountries = computed<TreatyRow[]>(() => {
  return Object.entries(TREATY_RATES_IRPF_2025)
    .filter(([, info]) => info.hasTreaty)
    .map<TreatyRow>(([code, info]) => ({
      code,
      name: getCountryName(code),
      ...info,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
})

const noTreatyCountries = computed<TreatyRow[]>(() => {
  return Object.entries(TREATY_RATES_IRPF_2025)
    .filter(([, info]) => !info.hasTreaty)
    .map<TreatyRow>(([code, info]) => ({
      code,
      name: getCountryName(code),
      ...info,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
})

const route = useRoute()
const root = useTemplateRef<HTMLElement>('root')

onMounted(() => {
  if (route.hash) {
    const el = document.getElementById(route.hash.slice(1))
    el?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }
  void root
})
</script>

<template>
  <div
    ref="root"
    class="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-8 print:block"
  >
    <!-- Tabla de contenidos -->
    <aside class="lg:sticky lg:top-20 lg:self-start print:hidden">
      <h2 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Conceptos
      </h2>
      <div class="space-y-4 text-sm">
        <div v-for="g in groups" :key="g.title">
          <div
            class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-2 mb-1"
          >
            {{ g.title }}
          </div>
          <ul class="space-y-0.5">
            <li v-for="s in g.sections" :key="s.id">
              <a
                :href="`#${s.id}`"
                class="block px-2 py-1.5 rounded hover:bg-slate-100 text-slate-700"
              >
                {{ s.title }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </aside>

    <!-- Artículos -->
    <div class="space-y-12 max-w-3xl">
      <header>
        <h1 class="text-3xl font-bold">Conceptos</h1>
        <p class="mt-2 text-slate-600">
          Explicaciones breves de los términos que aparecen en el resumen IRPF.
          El contenido es orientativo; la fuente canónica es siempre la
          <a
            href="https://sede.agenciatributaria.gob.es/"
            target="_blank"
            rel="noopener"
            class="text-blue-600 hover:underline"
            >Agencia Tributaria (AEAT)</a
          >.
        </p>
      </header>

      <!-- ==== Conceptos básicos ==== -->

      <article id="base-ahorro" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Base del ahorro</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            La Ley del IRPF divide la base imponible en dos partes con tipos
            impositivos distintos:
          </p>
          <ul class="list-disc pl-6 space-y-1">
            <li>
              <strong>Base general</strong>: rentas del trabajo (salario),
              actividades económicas, alquileres… Tipos progresivos altos (en
              torno al 19–47 % sumando la parte estatal y autonómica).
            </li>
            <li>
              <strong>Base del ahorro</strong>: dividendos, intereses,
              ganancias y pérdidas por venta de acciones/fondos, etc. Tipos más
              bajos que la base general, también progresivos por tramos (desde
              el 19 % para los primeros miles de euros).
            </li>
          </ul>
          <p>
            Los dividendos tributan siempre en la <strong>base del ahorro</strong>
            en el ejercicio en que se <em>cobran</em> (criterio de caja), no
            cuando se devengan. Por eso un dividendo con <em>ex-date</em> en
            diciembre pero <em>pay date</em> en enero del año siguiente se
            declara en la renta del año siguiente.
          </p>
          <p class="text-xs text-slate-500">
            Fuente:
            <a
              href="https://sede.agenciatributaria.gob.es/"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
              >Manual de Renta — AEAT</a
            >. Los tramos y porcentajes se revisan cada ejercicio.
          </p>
        </div>
      </article>

      <article id="dividendos" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Dividendos: bruto, neto, retención</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Cuando una empresa te paga un dividendo, a tu cuenta llega un
            importe que NO es lo que Hacienda considera tu ingreso. Hay tres
            conceptos:
          </p>
          <ul class="list-disc pl-6 space-y-1">
            <li>
              <strong>Bruto</strong>: lo que la empresa reparte por acción ×
              número de acciones.
            </li>
            <li>
              <strong>Retención</strong>: porcentaje que Hacienda (o el país
              emisor) retira <em>antes</em> de que el dinero llegue a tu cuenta.
            </li>
            <li>
              <strong>Neto</strong>: lo que efectivamente ingresas
              (bruto − retención).
            </li>
          </ul>
          <p>
            <strong>Ejemplo — Enagás</strong>: 76 acciones × 0,40 € por acción.
          </p>
          <pre class="bg-slate-100 rounded p-3 text-xs font-mono overflow-x-auto">Bruto:       30,40 €
Retención:    5,78 €  (19 % del bruto; retenida en España)
Neto:        24,62 €  (lo que aparece en tu cuenta)</pre>
          <p>
            En Renta Web hay que declarar el <strong>bruto</strong>, no el neto.
            La retención se indica en una casilla aparte.
          </p>
          <p>
            Para dividendos extranjeros la mecánica cambia: interviene el país
            origen con su retención, y se abre la deducción por
            <RouterLink to="#doble-imposicion" class="text-blue-600 hover:underline"
              >doble imposición internacional</RouterLink
            >.
          </p>
        </div>
      </article>

      <article id="divisas" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Divisas y tipo de cambio</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            En Renta Web todos los importes deben declararse en euros. Cuando
            cobras un dividendo en otra divisa (USD, GBP, CAD…) necesitas
            convertir cada evento a euros individualmente.
          </p>
          <p>
            <strong>Criterio AEAT</strong>: tipo de cambio del
            <em>día de cobro</em> del dividendo, NO el tipo de cierre del año.
            Aplica por cada evento — no puedes usar un tipo medio anual.
          </p>
          <p>Fuentes aceptadas:</p>
          <ul class="list-disc pl-6 space-y-1">
            <li>
              <strong>El tipo que aplicó tu broker</strong>: IBKR calcula
              <code class="font-mono text-xs bg-slate-100 px-1 rounded">GrossInBase</code>
              (columna del <code class="font-mono text-xs bg-slate-100 px-1 rounded">DividendReport.csv</code>)
              con su propio rate interbancario.
            </li>
            <li>
              <strong>El tipo oficial del BCE</strong>: publicado diariamente,
              consultable en
              <a
                href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"
                target="_blank"
                rel="noopener"
                class="text-blue-600 hover:underline"
                >ecb.europa.eu</a
              >.
            </li>
          </ul>
          <p>
            La AEAT acepta cualquier tipo "razonable y consistente". Lo
            importante es no mezclar criterios dentro del mismo ejercicio.
          </p>
          <p class="bg-slate-50 border border-slate-200 rounded p-3 text-sm">
            <strong>Esta app</strong>: usa el tipo que IBKR aplicó (viene
            precomputado en <code class="font-mono text-xs">GrossInBase</code>).
            La diferencia con el tipo BCE suele ser de centésimas; no cambia el
            fondo de la declaración.
          </p>
          <p>
            Si tu cuenta IBKR tiene divisa base distinta de EUR (p. ej. USD),
            los campos <code class="font-mono text-xs">*InBase</code> vienen en
            esa divisa y necesitarías una conversión adicional. Esta app asume
            base EUR por ahora.
          </p>
        </div>
      </article>

      <!-- ==== Doble imposición ==== -->

      <article id="doble-imposicion" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Doble imposición internacional</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Cuando cobras un dividendo de una empresa extranjera, dos países
            quieren gravarlo:
          </p>
          <ol class="list-decimal pl-6 space-y-1">
            <li>
              El <strong>país emisor</strong> retiene en origen
              (p. ej. EE. UU. retiene 15 % si tienes W-8BEN vigente; 30 % si no).
            </li>
            <li>
              <strong>España</strong> incluye el bruto en tu base del ahorro
              como rendimiento del capital mobiliario.
            </li>
          </ol>
          <p>
            Para evitar que pagues el impuesto dos veces, la Ley del IRPF
            permite <strong>deducir</strong> lo retenido en origen, con el
            <strong>límite del convenio</strong> bilateral España–país emisor
            (ver
            <RouterLink to="#convenios" class="text-blue-600 hover:underline"
              >tabla de convenios</RouterLink
            >).
          </p>
          <p>En Renta Web se reparte así:</p>
          <ul class="list-disc pl-6 space-y-1">
            <li>
              <strong>Casilla 0029 — Ingresos íntegros</strong>: TODOS los
              dividendos brutos en EUR (nacionales y extranjeros).
            </li>
            <li>
              <strong>Casilla 0029 — Retenciones</strong>: SOLO retenciones
              practicadas en España (con IBKR, normalmente 0 € salvo que tengas
              valores con ISIN español).
            </li>
            <li>
              <strong>Deducciones generales → Doble imposición internacional
              (base del ahorro)</strong>: bruto extranjero + impuesto satisfecho
              en el extranjero, limitado al % del convenio.
            </li>
          </ul>
          <p class="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <strong>Importante:</strong> si el país emisor te retuvo más de lo
            permitido por el convenio (p. ej. Bélgica retiene 30 % pero el
            convenio España-Bélgica es 15 %), el <strong>exceso no se recupera
            vía IRPF</strong>. Tendrías que reclamarlo al país emisor o al
            broker.
          </p>
          <p class="text-xs text-slate-500">
            Fuentes:
            <a
              href="https://sede.agenciatributaria.gob.es/"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
              >Manual de Renta (AEAT)</a
            >
            ·
            <a
              href="https://www.hacienda.gob.es/es-ES/Normativa%20y%20doctrina/Normativa/CDI/Paginas/CDI.aspx"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
              >Convenios de doble imposición vigentes (Hacienda)</a
            >.
          </p>
        </div>
      </article>

      <article id="convenios" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Convenios de doble imposición</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Acuerdos bilaterales entre España y cada país que fijan el
            <strong>porcentaje máximo</strong> que el país emisor puede retener
            sobre dividendos de cartera (participación &lt; 10 %), y que España
            reconocerá como deducción en tu IRPF por doble imposición.
          </p>
          <p>
            Si la retención real supera el tope del convenio, el exceso NO se
            deduce en IRPF; solo puedes intentar recuperarlo al país emisor.
          </p>

          <h3 class="text-lg font-semibold mt-6">Países con convenio</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th class="text-left py-2 pr-3">Código</th>
                  <th class="text-left pr-3">País</th>
                  <th class="text-right pr-3">Tope (%)</th>
                  <th class="text-left">Notas</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="c in treatyCountries" :key="c.code">
                  <td class="py-2 pr-3 font-mono text-xs">{{ c.code }}</td>
                  <td class="pr-3">{{ c.name }}</td>
                  <td class="text-right pr-3 tabular-nums">
                    {{ (c.rate * 100).toFixed(0) }} %
                  </td>
                  <td class="text-xs text-slate-600">{{ c.note ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 class="text-lg font-semibold mt-6">Jurisdicciones sin convenio</h3>
          <p class="text-sm text-slate-600">
            Si un país no tiene convenio con España, cualquier retención que te
            apliquen <strong>no es recuperable</strong> vía IRPF.
          </p>
          <ul class="list-disc pl-6 space-y-0.5 text-sm">
            <li v-for="c in noTreatyCountries" :key="c.code">
              <span class="font-mono text-xs text-slate-500 mr-2">{{ c.code }}</span>
              {{ c.name }}
              <span v-if="c.note" class="text-slate-500">— {{ c.note }}</span>
            </li>
          </ul>

          <p class="text-xs text-slate-500 mt-4">
            Estos porcentajes son los que aplica el motor de reglas de la app
            para el IRPF 2025. Los convenios cambian con protocolos; para casos
            no estándar (participaciones ≥ 10 %, fondos de pensiones, régimen
            especial) consulta el convenio concreto en
            <a
              href="https://www.hacienda.gob.es/es-ES/Normativa%20y%20doctrina/Normativa/CDI/Paginas/CDI.aspx"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
              >Hacienda — CDI vigentes</a
            >.
          </p>
        </div>
      </article>

      <article id="w8ben" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">W-8BEN: retención USA</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Si cobras dividendos de empresas de EE. UU., Interactive Brokers te
            debe haber pedido firmar un formulario <strong>W-8BEN</strong> del
            IRS (agencia tributaria estadounidense). Sirve para declarar que
            eres residente fiscal en España y beneficiarte del convenio.
          </p>
          <ul class="list-disc pl-6 space-y-1">
            <li>
              <strong>Con W-8BEN vigente</strong>: retención en origen del 15 %
              (lo que establece el convenio España–EE. UU.).
            </li>
            <li>
              <strong>Sin W-8BEN o caducado</strong>: retención del 30 %. El 15 %
              extra NO se recupera vía IRPF (el convenio limita la deducción al
              15 %). Perderías dinero irrecuperable.
            </li>
          </ul>
          <p>
            El W-8BEN caduca aproximadamente cada <strong>3 años</strong>; IBKR
            suele avisar por correo. Renovarlo a tiempo evita saltos al 30 %.
          </p>
        </div>
      </article>

      <!-- ==== Casos especiales ==== -->

      <article id="roc" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Return of Capital (ROC)</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Algunas empresas (especialmente REITs estadounidenses como APLE, O,
            N2IU) reparten distribuciones que, fiscalmente en su jurisdicción,
            no son dividendos "reales" sino <strong>devolución de capital</strong>.
          </p>
          <p>En términos fiscales:</p>
          <ul class="list-disc pl-6 space-y-1">
            <li>El ROC <strong>no tributa</strong> como rendimiento del capital mobiliario.</li>
            <li>
              El ROC <strong>reduce tu coste de adquisición</strong>. Cuando
              vendas esas acciones, la plusvalía se calcula sobre un coste menor
              (y por tanto pagarás más si vendes con beneficio).
            </li>
          </ul>
          <p><strong>Ejemplo</strong>:</p>
          <pre class="bg-slate-100 rounded p-3 text-xs font-mono overflow-x-auto">Compras 100 APLE a 10 € →  coste 1.000 €
Recibes 50 € en distribuciones, de las cuales
  40 € son ordinario → TRIBUTAN (casilla 0029)
  10 € son ROC       → NO tributan, pero bajan coste
Coste ajustado: 1.000 − 10 = 990 €
Al vender, la plusvalía se calcula sobre 990 €.</pre>
          <p>
            Esta app detecta el componente ROC desde el
            <code class="font-mono text-xs bg-slate-100 px-1 rounded">DividendReport.csv</code>
            (columna <code class="font-mono text-xs bg-slate-100 px-1 rounded">RevenueComponent</code>)
            y lo separa del dividendo ordinario. La parte ROC aparece aparte en
            el resumen, etiquetada para que puedas ajustar tu coste cuando
            vendas.
          </p>
        </div>
      </article>

      <article id="fifo" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">FIFO y plusvalías</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>
            Cuando vendes acciones en España, la ganancia o pérdida patrimonial
            se calcula con el método <strong>FIFO</strong> (first in, first
            out): las primeras acciones que compraste son las primeras que se
            consideran vendidas.
          </p>

          <h3 class="text-lg font-semibold mt-4">Cómo se aplica</h3>
          <p>
            Por valor/ISIN, sumando <strong>todas tus cuentas</strong>. Si
            tienes el mismo valor en IBKR y en otro broker, Hacienda los
            consolida para el cálculo FIFO.
          </p>
          <p><strong>Ejemplo</strong>:</p>
          <pre class="bg-slate-100 rounded p-3 text-xs font-mono overflow-x-auto">Compras:
  Ene 2024: 100 acciones XYZ a 10 €  →  coste 1.000 €
  Jun 2024: 100 acciones XYZ a 12 €  →  coste 1.200 €

Venta (Oct 2025): 150 acciones XYZ a 15 €  →  venta 2.250 €

FIFO → se consideran vendidas:
  100 del lote de enero (coste 1.000 €)
   50 del lote de junio (coste 50 × 12 = 600 €)
Coste total vendido: 1.600 €

Ganancia patrimonial = 2.250 − 1.600 = 650 €
Esta ganancia va a la base del ahorro.</pre>

          <h3 class="text-lg font-semibold mt-4">IBKR usa otro criterio</h3>
          <p>
            IBKR puede aplicar LIFO, coste medio o "specific identification"
            según tu configuración. Esto <strong>NO coincide con FIFO español</strong>.
            El cost basis que IBKR te muestra no es el que usa la AEAT.
          </p>

          <h3 class="text-lg font-semibold mt-4">Regla anti-elusión (2 meses / 1 año)</h3>
          <p>
            Si obtienes una pérdida vendiendo y
            <strong>recompras el mismo valor</strong> en ≤ 2 meses (mercado
            español) o ≤ 1 año (mercado extranjero), la pérdida NO se computa
            hasta que cierres definitivamente la posición. Previene que se
            simulen pérdidas para compensar ganancias.
          </p>

          <h3 class="text-lg font-semibold mt-4">En esta app</h3>
          <p>
            El motor aplica <strong>FIFO español</strong> por ISIN (art. 37.2
            LIRPF) y emite una tabla con el valor de transmisión, el valor de
            adquisición consumido y la ganancia o pérdida por cada venta.
          </p>
          <p>
            Para construir la base de coste correcta, la app
            <strong>agrega automáticamente los extractos de años anteriores</strong>
            que hayas cargado para la misma cuenta IBKR. Ejemplo: si en 2025
            vendes 100 acciones de ENG que compraste 80 en 2023 y 20 en 2024,
            basta con haber cargado antes las sesiones de 2023 y 2024 — el motor
            consume los lotes en orden cronológico sin que tengas que reintroducir
            nada manualmente.
          </p>
          <p>
            Si al calcular una venta <strong>no hay compras previas suficientes</strong>
            en los extractos cargados (porque no has subido el año de la
            adquisición), la app marca la fila en rojo con un aviso claro. El
            coste faltante se asume como 0, lo que infla la ganancia: cárgalo o
            complétalo manualmente antes de declarar.
          </p>
          <p>
            La <strong>regla anti-elusión (2m / 1a)</strong> se detecta y se
            flaguea con una etiqueta ámbar en la fila afectada, pero
            <strong>la app NO difiere automáticamente la pérdida</strong>. La
            decisión sobre si aplicar el diferimiento queda al criterio del
            usuario y su asesor; la app solo avisa para que no pase desapercibido.
          </p>
          <p>
            <strong>Acciones corporativas (splits, spinoffs, fusiones)</strong>
            están fuera del alcance del motor v1. Si tu extracto contiene alguna,
            la app emite un aviso recordándolo y el cálculo requiere revisión
            manual.
          </p>

          <p class="text-xs text-slate-500">
            Fuente:
            <a
              href="https://sede.agenciatributaria.gob.es/"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
              >Manual de Renta — Ganancias y pérdidas patrimoniales (AEAT)</a
            >.
          </p>
        </div>
      </article>

      <!-- ==== Práctica ==== -->

      <article id="extracto-ibkr" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">El extracto de IBKR</h2>
        <div class="mt-3 space-y-3 text-slate-700">
          <p>Interactive Brokers ofrece dos informes anuales relevantes:</p>
          <ul class="list-disc pl-6 space-y-2">
            <li>
              <strong>
                <code class="font-mono text-sm bg-slate-100 px-1 rounded">DividendReport.csv</code>
              </strong>
              — informe fiscal específico de dividendos y retenciones. Incluye
              el equivalente en tu divisa base (EUR), el país de origen y el
              desglose por componente (ordinario vs ROC). Es la fuente canónica
              para el IRPF.
            </li>
            <li>
              <strong>
                <code class="font-mono text-sm bg-slate-100 px-1 rounded">Informe de Actividad.csv</code>
              </strong>
              — informe operativo completo: trades, comisiones, intereses,
              movimientos de caja, posiciones, ISINs. Útil para la app como
              complemento (enriquece nombres de empresa e ISINs) y para el
              cross-check.
            </li>
          </ul>
          <p>
            <strong>Dónde obtenerlos</strong>: en IBKR Client Portal →
            <em>Informes → Impuestos (Tax) → Dividend Report</em> y
            <em>Informes → Actividad → Anual</em>. Selecciona el año completo y
            formato CSV.
          </p>
        </div>
      </article>

      <article id="errores-comunes" class="scroll-mt-20">
        <h2 class="text-2xl font-bold">Errores comunes</h2>
        <div class="mt-3 space-y-5 text-slate-700">
          <p>
            Revisa esta lista antes de presentar. Son los fallos más frecuentes
            en declaraciones con dividendos IBKR.
          </p>

          <div>
            <h3 class="font-semibold text-slate-900">1. Declarar el neto en lugar del bruto</h3>
            <p class="mt-1">
              Si tu dividendo bruto es 30,40 € y el broker te ha retenido
              5,78 €, a tu cuenta llegan 24,62 €. <strong>Declara 30,40 €</strong>
              (bruto) con retención 5,78 €, NO 24,62 € sin retención. Si
              declaras el neto, estás pagando impuestos por un dinero que ya te
              retuvieron.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">
              2. Poner retenciones extranjeras en la casilla de Retenciones de España
            </h3>
            <p class="mt-1">
              La casilla "Retenciones" de la Casilla 0029 solo acepta
              retenciones practicadas en España. Las retenciones extranjeras
              (USA, UK, etc.) van en la
              <RouterLink to="#doble-imposicion" class="text-blue-600 hover:underline"
                >deducción por doble imposición internacional</RouterLink
              >, apartado aparte.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">3. Olvidar la deducción por doble imposición</h3>
            <p class="mt-1">
              Si cobraste dividendos extranjeros, DEBES rellenar el bloque de
              doble imposición. Si no lo haces, pagas dos veces (una al país
              emisor, otra a España).
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">4. Declarar ROC como dividendo ordinario</h3>
            <p class="mt-1">
              El <RouterLink to="#roc" class="text-blue-600 hover:underline">Return of Capital</RouterLink>
              NO tributa como rendimiento. Reduce el coste de adquisición para
              cuando vendas. Si lo declaras como dividendo normal, pagas
              impuestos sobre algo que no tributa.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">5. No renovar el W-8BEN</h3>
            <p class="mt-1">
              El
              <RouterLink to="#w8ben" class="text-blue-600 hover:underline">W-8BEN</RouterLink>
              caduca cada ~3 años. Si caduca, IBKR te retiene el 30 % en
              dividendos USA en lugar del 15 %. El 15 % extra no se recupera en
              IRPF.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">6. Declarar un dividendo en el año equivocado</h3>
            <p class="mt-1">
              Criterio de caja: el dividendo tributa en el año en que se
              <em>cobra</em>, no cuando se devenga. Un dividendo con pay date
              en enero 2026 va al IRPF de 2026, aunque el ex-date fuera en
              diciembre 2025.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">7. Confundir ingresos con rendimientos</h3>
            <p class="mt-1">
              Un depósito en tu cuenta IBKR no es un ingreso fiscal. Solo son
              tributables los eventos específicos (dividendos, ventas con
              plusvalía, intereses, cupones…). Mover dinero entre tus propias
              cuentas no genera hecho imponible.
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-slate-900">8. Ignorar el exceso sobre convenio</h3>
            <p class="mt-1">
              Si el país emisor te retuvo más de lo que permite el
              <RouterLink to="#convenios" class="text-blue-600 hover:underline">convenio</RouterLink>
              (p. ej. Bélgica al 30 %, convenio al 15 %), esa diferencia NO se
              recupera vía IRPF. Esta app la marca en ámbar para que al menos
              sepas que la estás perdiendo y puedas decidir si reclamar al
              broker.
            </p>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
