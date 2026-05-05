<script setup lang="ts">
import { Coffee, Github, Lock, ShieldAlert } from 'lucide-vue-next'
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8 space-y-8">
    <header>
      <h1 class="text-3xl font-bold">Acerca de taxES</h1>
      <p class="mt-2 text-slate-600">
        Una herramienta para preparar la declaración de la renta española (IRPF)
        a partir de los extractos anuales de Interactive Brokers.
      </p>
    </header>

    <section class="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
      <h2 class="text-lg font-semibold">¿Qué hace?</h2>
      <p class="text-sm text-slate-700">
        Sube tu
        <code class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded"
          >DividendReport.csv</code
        >
        y opcionalmente tu
        <code class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded"
          >Informe de Actividad.csv</code
        >
        del broker. La app parsea los ficheros, aplica las reglas fiscales
        españolas (convenios de doble imposición, Return of Capital, criterio
        de caja, FIFO para plusvalías…) y te devuelve los importes exactos
        para volcar en Renta Web: Casilla 0029, deducción por doble imposición
        internacional, ganancias y pérdidas patrimoniales por transmisión de
        valores, desglose por país, avisos sobre retenciones por encima del
        convenio, etc.
      </p>
      <p class="text-sm text-slate-700">
        Para el cálculo FIFO de plusvalías, la app agrega automáticamente los
        extractos de años anteriores que hayas cargado para la misma cuenta
        IBKR. Una venta en 2025 puede consumir lotes cargados en la sesión de
        2024 sin necesidad de re-subir CSV.
      </p>
      <p class="text-sm text-slate-700">
        Puedes exportar el resumen como JSON (reimportable), CSV (resumen por
        país, dividendos, plusvalías — abre en Excel) o como
        <strong>backup portable cifrado</strong> con passphrase, pensado para
        guardar en Drive/iCloud/USB sin exponer el contenido.
      </p>
    </section>

    <section class="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <Lock class="w-5 h-5 text-emerald-600" />
        Privacidad
      </h2>
      <p class="text-sm text-slate-700">
        Todo el parseo sucede en tu navegador. Los CSV y los datos extraídos
        <strong>nunca salen de tu dispositivo</strong>. La app no tiene backend
        con datos de usuario. Las sesiones se guardan localmente en IndexedDB
        del navegador; puedes exportarlas como JSON plano, como backup
        <strong>cifrado con passphrase</strong> (AES-GCM-256 + PBKDF2 600k
        iteraciones) para almacenar fuera del navegador con seguridad, o
        borrarlas en cualquier momento desde el selector de sesiones.
      </p>
    </section>

    <section
      class="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-2"
    >
      <h2 class="text-lg font-semibold flex items-center gap-2 text-amber-900">
        <ShieldAlert class="w-5 h-5" />
        No es asesoramiento fiscal
      </h2>
      <p class="text-sm text-amber-900">
        Esta herramienta NO es asesoramiento fiscal. Es una ayuda para preparar
        los importes siguiendo las reglas generales del Manual de Renta (AEAT).
        Revisa siempre los valores antes de presentar la declaración y consulta
        con un asesor para casos particulares (participaciones ≥ 10 %, fondos
        de pensiones, regímenes especiales, divisas no publicadas por el BCE,
        etc.).
      </p>
    </section>

    <section class="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
      <h2 class="text-lg font-semibold">Código abierto</h2>
      <p class="text-sm text-slate-700">
        Puedes contribuir, reportar bugs o sugerir mejoras en GitHub.
      </p>
      <div class="flex flex-wrap gap-2 pt-1">
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
        >
          <Github class="w-4 h-4" />
          Repositorio en GitHub
        </a>
      </div>
    </section>

    <section
      class="bg-gradient-to-br from-amber-50 to-rose-50 border border-rose-200 rounded-xl p-6 space-y-3 text-center"
    >
      <h2 class="text-lg font-semibold">¿Te ha sido útil?</h2>
      <p class="text-sm text-slate-700">
        Si la app te ha ahorrado tiempo o dinero — por ejemplo, cazar
        retenciones excedidas sobre convenio, evitar tratar ROC como tributable
        o calcular plusvalías FIFO multi-año sin Excel — considera invitarme a
        un café. Cada donación motiva a seguir añadiendo features (otros
        brokers, Modelo 720, dark mode…).
      </p>
      <div class="pt-2">
        <a
          href="https://ko-fi.com/kumoricuba"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-sm transition-colors"
          style="background-color: #ff5e5b"
          onmouseover="this.style.backgroundColor='#e54f4c'"
          onmouseout="this.style.backgroundColor='#ff5e5b'"
        >
          <Coffee class="w-5 h-5" />
          Invítame un café en Ko-fi
        </a>
      </div>
      <p class="text-xs text-slate-500 pt-2">
        ko-fi.com/kumoricuba · opcional, sin ataduras
      </p>
    </section>
  </div>
</template>
