<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import {
  BookOpen,
  Briefcase,
  Home as HomeIcon,
  Info,
  ListChecks,
  Printer,
  X,
} from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function close(): void {
  emit('update:open', false)
}

/**
 * Cierra el drawer y dispara el diálogo de impresión del navegador sobre
 * la página actual. El drawer está `print:hidden`, así que aunque el
 * timeout no terminara, no aparecería en la impresión.
 */
function onPrintCurrentPage(): void {
  close()
  setTimeout(() => window.print(), 220)
}
function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) close()
}
function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}
onMounted(() => document.addEventListener('keydown', onEscape))
onUnmounted(() => document.removeEventListener('keydown', onEscape))

// Bloquea el scroll del body mientras el drawer esté abierto.
watch(
  () => props.open,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
  },
)
</script>

<template>
  <transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 bg-slate-900/40 z-40 print:hidden"
      @click="onBackdrop"
    >
      <transition
        enter-active-class="transition-transform duration-200"
        leave-active-class="transition-transform duration-200"
        enter-from-class="translate-x-full"
        leave-to-class="translate-x-full"
        appear
      >
        <aside
          v-if="open"
          class="fixed top-0 right-0 h-full w-72 sm:w-80 bg-white shadow-xl flex flex-col"
          @click.stop
        >
          <div class="p-4 flex items-center justify-between border-b border-slate-200">
            <span class="text-sm font-medium text-slate-500">Menú</span>
            <button
              type="button"
              class="p-2 rounded-lg hover:bg-slate-100"
              aria-label="Cerrar menú"
              @click="close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          <nav class="flex-1 p-2 space-y-0.5 overflow-y-auto">
            <RouterLink
              to="/"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              active-class="bg-slate-100 text-slate-900 font-medium"
              @click="close"
            >
              <HomeIcon class="w-4 h-4" />
              Resumen IRPF
            </RouterLink>
            <RouterLink
              to="/conceptos"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              active-class="bg-slate-100 text-slate-900 font-medium"
              @click="close"
            >
              <BookOpen class="w-4 h-4" />
              Conceptos
            </RouterLink>
            <RouterLink
              to="/preparacion-ibkr"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              active-class="bg-slate-100 text-slate-900 font-medium"
              @click="close"
            >
              <Briefcase class="w-4 h-4" />
              Preparación (IBKR)
            </RouterLink>
            <RouterLink
              to="/renta-web"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              active-class="bg-slate-100 text-slate-900 font-medium"
              @click="close"
            >
              <ListChecks class="w-4 h-4" />
              Guía Renta Web
            </RouterLink>
            <RouterLink
              to="/acerca-de"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              active-class="bg-slate-100 text-slate-900 font-medium"
              @click="close"
            >
              <Info class="w-4 h-4" />
              Acerca de
            </RouterLink>
          </nav>

          <!-- Acción separada: no es una ruta, dispara window.print() sobre la
               página actual. Aislada del nav para que no parezca que el botón
               lleva a una página que luego imprime lo que haya en esa página. -->
          <div class="p-2 border-t border-slate-200">
            <button
              type="button"
              class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700"
              @click="onPrintCurrentPage"
            >
              <Printer class="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
          </div>

          <div class="p-4 border-t border-slate-200 text-xs text-slate-500">
            taxES · herramienta de ayuda para el IRPF español desde IBKR. No es
            asesoramiento fiscal.
          </div>
        </aside>
      </transition>
    </div>
  </transition>
</template>
