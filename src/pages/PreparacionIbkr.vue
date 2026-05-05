<script setup lang="ts">
import { computed, toRef } from 'vue'
import { AlertTriangle, CheckSquare, ExternalLink, FileText, RotateCcw, Square } from 'lucide-vue-next'
import {
  CHECKLIST_ITEMS,
  useAnnualChecklist,
  type ChecklistItemId,
} from '@composables/useAnnualChecklist'
import { useSessionStore } from '@stores/session'

const store = useSessionStore()

const taxYear = toRef(store, 'currentTaxYear')
const accountId = toRef(store, 'currentAccountId')

const {
  state: checklist,
  reset,
  completedCount,
  totalRequired,
} = useAnnualChecklist(taxYear, accountId)

function toggle(id: ChecklistItemId): void {
  checklist.value = { ...checklist.value, [id]: !checklist.value[id] }
}

const sessionLabel = computed(() => {
  if (taxYear.value && accountId.value) {
    return `Renta ${taxYear.value} · ${accountId.value}`
  }
  return null
})

interface DocRow {
  name: string
  shortDesc: string
  where: string
  useFor: string
  mandatory: 'always' | 'if-usa' | 'if-ca' | 'optional' | 'recommended'
}

const docRows: DocRow[] = [
  {
    name: 'DividendReport.csv',
    shortDesc: 'Informe fiscal de dividendos y retenciones',
    where: 'Reports → Tax → Dividend Report',
    useFor:
      'Fuente canónica de dividendos y retenciones. Base de la app para la Casilla 0029 y la doble imposición.',
    mandatory: 'always',
  },
  {
    name: 'Informe de Actividad.csv',
    shortDesc: 'Actividad anual completa (trades, fees, cash, ISINs)',
    where: 'Reports → Activity → anual, formato CSV',
    useFor:
      'Imprescindible para FIFO de plusvalías. Enriquece ISINs y nombres; valida cruzadamente los totales del Dividend Report.',
    mandatory: 'always',
  },
  {
    name: 'FX Income Worksheet (CSV/PDF)',
    shortDesc: 'Tipo de cambio que IBKR aplicó evento a evento',
    where: 'Reports → Tax → FX Income Worksheet',
    useFor:
      'Referencia alternativa al tipo del BCE. Útil cuando hay divisas no publicadas por el BCE (p. ej. TWD) o para auditar los EUR calculados por la app.',
    mandatory: 'optional',
  },
  {
    name: 'Formulario 1042-S',
    shortDesc: 'Certificado oficial de retenciones en USA',
    where: 'Reports → Tax → 1042-S',
    useFor:
      'Prueba ante la AEAT de las retenciones practicadas en origen por entidades estadounidenses. Se emite en febrero-marzo del año siguiente al ejercicio.',
    mandatory: 'if-usa',
  },
  {
    name: 'Formulario NR4',
    shortDesc: 'Certificado oficial de retenciones en Canadá',
    where: 'Reports → Tax → NR4',
    useFor:
      'Equivalente canadiense del 1042-S. Prueba de retenciones canadienses ante la AEAT si alguna vez las cuestiona.',
    mandatory: 'if-ca',
  },
  {
    name: 'Dividend Tax Vouchers',
    shortDesc: 'Recibos oficiales por cada dividendo',
    where: 'Reports → Tax → Dividend Tax Vouchers (por país)',
    useFor:
      'Justificante per-dividendo. Útil cuando un país emisor (UK, CH, DE, FR, BE…) no emite un formulario equivalente al 1042-S.',
    mandatory: 'recommended',
  },
]

function mandatoryLabel(m: DocRow['mandatory']): { text: string; cls: string } {
  switch (m) {
    case 'always':
      return { text: 'Obligatorio', cls: 'bg-red-100 text-red-800' }
    case 'if-usa':
      return { text: 'Si hay USA', cls: 'bg-blue-100 text-blue-800' }
    case 'if-ca':
      return { text: 'Si hay Canadá', cls: 'bg-blue-100 text-blue-800' }
    case 'recommended':
      return { text: 'Recomendado', cls: 'bg-amber-100 text-amber-800' }
    case 'optional':
      return { text: 'Opcional', cls: 'bg-slate-100 text-slate-700' }
  }
}

interface RefundRow {
  country: string
  name: string
  defaultRate: string
  treatyCap: string
  excessRecoverable: string
  howToReclaim: string
}

const refundRows: RefundRow[] = [
  {
    country: 'US',
    name: 'Estados Unidos',
    defaultRate: '30 % sin W-8BEN',
    treatyCap: '15 %',
    excessRecoverable: 'Renovando W-8BEN (prevención). Reclamación a IRS es compleja y rara vez rentable.',
    howToReclaim:
      'Prevención: W-8BEN vigente en IBKR. Si aparece retenido al 30 %, renuévalo y contacta a IBKR; el 15 % extra suele darse por perdido.',
  },
  {
    country: 'BE',
    name: 'Bélgica',
    defaultRate: '30 %',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, vía reembolso al Tax Administration belga.',
    howToReclaim:
      'Formulario "Convention préventive de la double imposition" (Mod. 276 Div). Plazo 5 años. Requiere certificado de residencia fiscal española.',
  },
  {
    country: 'DE',
    name: 'Alemania',
    defaultRate: '26,375 % (25 % + 5,5 % Soli)',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, vía Bundeszentralamt für Steuern (BZSt).',
    howToReclaim:
      'Formulario EU-012 + certificado de residencia fiscal ES. Plazo 4 años. Online en bzst.de.',
  },
  {
    country: 'FR',
    name: 'Francia',
    defaultRate: '12,8 %',
    treatyCap: '15 %',
    excessRecoverable: 'Normalmente no hay exceso (retención por debajo del tope).',
    howToReclaim: 'Si excepcionalmente retuvieron 25 %: Formulario 5000/5001 ante la Dirección de Impuestos francesa.',
  },
  {
    country: 'IT',
    name: 'Italia',
    defaultRate: '26 %',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, vía Agenzia delle Entrate.',
    howToReclaim:
      'Modelo "Istanza di rimborso". Proceso lento (puede tardar >1 año). Algunos brokers ofrecen relief-at-source con form ITA001 previo.',
  },
  {
    country: 'CH',
    name: 'Suiza',
    defaultRate: '35 %',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, vía Verwaltung der Eidg. Steuerverwaltung (ESTV).',
    howToReclaim: 'Formulario 85 ante la ESTV. Certificado de residencia ES. Plazo 3 años.',
  },
  {
    country: 'AT',
    name: 'Austria',
    defaultRate: '27,5 %',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, vía BMF (Bundesministerium für Finanzen).',
    howToReclaim: 'Formulario ZS-RD1 + certificado de residencia. Plazo 5 años.',
  },
  {
    country: 'JP',
    name: 'Japón',
    defaultRate: '20,315 %',
    treatyCap: '15 %',
    excessRecoverable: 'Sí, pero el exceso es pequeño (≈ 5 %).',
    howToReclaim: 'Modelo 8 (Application Form for Refund) ante la National Tax Agency. Plazo 5 años.',
  },
]
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8 space-y-10">
    <header>
      <h1 class="text-3xl font-bold">Preparación fiscal (IBKR)</h1>
      <p class="mt-2 text-slate-600">
        Parte práctica y operativa: qué documentos descargar, cómo minimizar
        retenciones en origen, qué significan herramientas como «Tax Planner» y
        «Tax Optimizer», y una lista de verificación anual antes de declarar.
      </p>
      <p class="mt-2 text-xs text-slate-500">
        Para los conceptos fiscales españoles (base del ahorro, convenios, FIFO…)
        ve a
        <RouterLink to="/conceptos" class="text-blue-600 hover:underline"
          >Conceptos</RouterLink
        >. Para el volcado paso a paso en el formulario oficial, a
        <RouterLink to="/renta-web" class="text-blue-600 hover:underline"
          >Guía Renta Web</RouterLink
        >.
      </p>
    </header>

    <!-- Bloque 1: Documentos que descargar -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <FileText class="w-5 h-5 text-slate-500" />
        1. Documentos que debes descargar cada año
      </h2>
      <p class="mt-2 text-sm text-slate-600">
        IBKR emite varios informes al cerrarse el ejercicio. No todos sirven para
        la declaración — aquí están los relevantes, en orden de importancia.
      </p>

      <div class="mt-5 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
              <th class="text-left py-2 pr-4">Documento</th>
              <th class="text-left pr-4">Dónde</th>
              <th class="text-left pr-4">Para qué</th>
              <th class="text-left">Relevancia</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in docRows" :key="row.name" class="align-top">
              <td class="py-3 pr-4">
                <div class="font-mono text-xs font-medium">{{ row.name }}</div>
                <div class="text-xs text-slate-500 mt-0.5">{{ row.shortDesc }}</div>
              </td>
              <td class="py-3 pr-4 text-xs text-slate-600">{{ row.where }}</td>
              <td class="py-3 pr-4 text-xs text-slate-700">{{ row.useFor }}</td>
              <td class="py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  :class="mandatoryLabel(row.mandatory).cls"
                >
                  {{ mandatoryLabel(row.mandatory).text }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
        <div class="font-medium text-slate-900 mb-1">¿Cuáles subir a esta app?</div>
        <p>
          Solo los <strong>dos primeros</strong>:
          <code class="font-mono text-xs bg-white border border-slate-200 px-1 rounded">DividendReport.csv</code>
          y
          <code class="font-mono text-xs bg-white border border-slate-200 px-1 rounded">Informe de Actividad.csv</code>.
          El resto (1042-S, NR4, vouchers, FX Worksheet) son
          <strong>pruebas que tú conservas</strong> por si la AEAT alguna vez pide justificante;
          no se cargan en la app.
        </p>
        <p class="mt-2 text-xs text-slate-500">
          Plazo de conservación recomendado: <strong>cuatro años</strong> desde la fecha
          límite de presentación (coincide con la prescripción fiscal general en España).
        </p>
      </div>
    </section>

    <!-- Bloque 2: Minimizar pérdidas -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h2 class="text-lg font-semibold">
        2. Cómo minimizar pérdidas por retención en origen
      </h2>

      <div class="mt-3 space-y-3 text-sm text-slate-700">
        <p>
          Cuando un país emisor retiene por encima del tope del convenio con España, el exceso
          <strong>no se recupera vía IRPF</strong> (la deducción por doble imposición se limita
          al tope del convenio). Solo hay dos caminos: prevenirlo desde el broker, o reclamar
          el exceso directamente al país emisor.
        </p>
      </div>

      <div class="mt-5 space-y-3">
        <h3 class="text-sm font-semibold text-slate-900">Acciones permanentes en IBKR</h3>
        <ul class="text-sm text-slate-700 list-disc pl-6 space-y-2">
          <li>
            <strong>W-8BEN vigente</strong> (USA): declara que eres residente fiscal en
            España y activa el tope del convenio (15 %). Caduca cada ~3 años; renuévalo a
            tiempo para evitar saltos al 30 %. IBKR avisa por correo.
          </li>
          <li>
            <strong>Certificado de residencia fiscal española</strong>: varios países
            permiten <em>relief-at-source</em> (aplicar el tope del convenio directamente
            en el momento del pago) si presentas el certificado. Lo emite la AEAT online; es
            gratuito. Cada país tiene su formulario de acompañamiento (Italia: ITA001;
            Francia: 5000; etc.).
          </li>
          <li>
            <strong>Preferir la acción ordinaria frente al ADR</strong> cuando exista: los
            ADR suelen llevar una comisión de custodio y pueden tener retenciones dobles
            (país emisor + USA como intermediario) más complicadas de recuperar.
          </li>
          <li>
            <strong>ETFs UCITS domiciliados en Irlanda</strong> para exposición a mercados
            con retenciones altas: simplifican la fiscalidad del inversor final porque el
            propio ETF gestiona la retención a nivel subyacente.
          </li>
        </ul>
      </div>

      <div class="mt-6 space-y-3">
        <h3 class="text-sm font-semibold text-slate-900">
          Reclamaciones post-facto por país (cuando ya te retuvieron de más)
        </h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-slate-500 uppercase border-b border-slate-200">
                <th class="text-left py-2 pr-3">País</th>
                <th class="text-left pr-3">Retención por defecto</th>
                <th class="text-left pr-3">Tope convenio</th>
                <th class="text-left">Cómo reclamar el exceso</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in refundRows" :key="r.country" class="align-top">
                <td class="py-2 pr-3">
                  <span class="font-mono text-xs text-slate-500 mr-1">{{ r.country }}</span>
                  {{ r.name }}
                </td>
                <td class="py-2 pr-3 text-xs">{{ r.defaultRate }}</td>
                <td class="py-2 pr-3 text-xs font-medium">{{ r.treatyCap }}</td>
                <td class="py-2 text-xs text-slate-700">{{ r.howToReclaim }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <div class="font-medium text-amber-900 mb-1">¿Cuándo reclamar y cuándo dejarlo correr?</div>
        <p class="text-amber-900">
          Una reclamación implica tiempo, un certificado de residencia, formularios en
          idioma del país y a veces gestoría local. Regla práctica: si el exceso anual es
          <strong>&lt; 30 €</strong>, el coste de oportunidad supera al beneficio. Por
          encima de ~100 € ya compensa claramente; entre ambos valores depende de tu
          tolerancia al papeleo. La app marca el exceso por país en el resumen principal.
        </p>
      </div>
    </section>

    <!-- Bloque 3: Tax Planner / Tax Optimizer -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <AlertTriangle class="w-5 h-5 text-amber-600" />
        3. Tax Planner y Tax Optimizer de IBKR — cuidado
      </h2>

      <div class="mt-3 space-y-3 text-sm text-slate-700">
        <p>
          IBKR ofrece dos herramientas con nombres atractivos que conviene situar:
          <strong>Tax Planner</strong> y <strong>Tax Optimizer</strong>. Ambas son
          <strong>US-centric</strong> (pensadas para el IRS y el formulario 1099/1042-S)
          y, aunque dan información útil, <strong>no aplican al IRPF español</strong>.
        </p>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <strong>Tax Planner</strong>: estima tu factura fiscal en EE. UU.
            Incluye capital gains por año, dividendos calificados vs ordinarios, etc.
            Todo relevante si presentas impuestos al IRS — para un residente fiscal
            español sirve solo como referencia <em>indicativa</em>.
          </li>
          <li>
            <strong>Tax Optimizer</strong>: te permite elegir el
            <strong>«Account Match Method»</strong> para las ventas (cómo identifica
            IBKR qué lote se está vendiendo). Opciones: FIFO, LIFO, Max Gain, Min Gain,
            Highest Cost, Specific Identification, etc.
          </li>
        </ul>
        <p class="bg-red-50 border border-red-200 rounded-lg p-3">
          <strong>Clave:</strong> el «Account Match Method» de IBKR solo afecta
          <strong>cómo IBKR te reporta</strong> las ventas en sus informes.
          <strong>No cambia lo que debes declarar en España.</strong> La Ley del IRPF
          español (art. 37.2 LIRPF) obliga a usar <strong>FIFO por ISIN</strong>
          sumando todas tus cuentas. Si en IBKR tienes configurado LIFO o Max Gain,
          los números que verás en su interfaz <strong>no coincidirán</strong> con los
          que te pide AEAT — y por eso esta app recalcula todo con FIFO español a
          partir de tus trades.
        </p>
        <p>
          <strong>Recomendación práctica:</strong> configura el Tax Optimizer en
          <strong>FIFO</strong> para minimizar la divergencia visual entre IBKR y
          AEAT. No cambia la realidad fiscal (lo que diga el motor español es lo que
          pide Hacienda), pero reduce confusión al conciliar números.
        </p>
      </div>
    </section>

    <!-- Bloque 4: Checklist anual persistida -->
    <section class="bg-white rounded-xl border border-slate-200 p-6">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <CheckSquare class="w-5 h-5 text-slate-500" />
            4. Checklist anual antes de presentar
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            <template v-if="sessionLabel">
              Estado guardado para
              <span class="font-mono text-xs">{{ sessionLabel }}</span>
              — {{ completedCount }} / {{ totalRequired }} obligatorios
            </template>
            <template v-else>
              Sin sesión activa: el estado no se guarda entre recargas.
              <RouterLink to="/" class="text-blue-600 hover:underline"
                >Carga primero un extracto</RouterLink
              >.
            </template>
          </p>
        </div>
        <button
          v-if="sessionLabel"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          @click="reset"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          Reiniciar
        </button>
      </div>

      <ul class="mt-5 space-y-2">
        <li
          v-for="item in CHECKLIST_ITEMS"
          :key="item.id"
          class="flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer"
          :class="
            checklist[item.id]
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          "
          @click="toggle(item.id)"
        >
          <CheckSquare
            v-if="checklist[item.id]"
            class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
          />
          <Square v-else class="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-900 flex flex-wrap items-baseline gap-2">
              {{ item.label }}
              <span
                v-if="item.optional"
                class="text-[10px] uppercase tracking-wide text-slate-400 font-normal"
                >opcional</span
              >
            </div>
            <div v-if="item.hint" class="text-xs text-slate-500 mt-0.5">
              {{ item.hint }}
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- Enlaces oficiales de apoyo -->
    <section class="bg-slate-50 rounded-xl p-6 text-sm">
      <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Enlaces externos de apoyo
      </h3>
      <ul class="space-y-1.5 text-slate-700">
        <li>
          <a
            href="https://www.interactivebrokers.com/en/support/tax-information.php"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            IBKR — Tax Information Center
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </li>
        <li>
          <a
            href="https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G306.shtml"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            AEAT — Certificado de residencia fiscal española
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
          <span class="text-slate-500"> · gratuito; plantilla con convenio para relief-at-source.</span>
        </li>
        <li>
          <a
            href="https://www.hacienda.gob.es/es-ES/Normativa%20y%20doctrina/Normativa/CDI/Paginas/CDI.aspx"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
          >
            Hacienda — Convenios de doble imposición vigentes
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </li>
      </ul>
    </section>

    <p class="text-xs text-slate-400">
      La información de reclamaciones por país es orientativa. Formularios, plazos y
      procedimientos cambian; antes de iniciar una reclamación verifica la información
      vigente en la autoridad fiscal del país correspondiente.
    </p>
  </div>
</template>
