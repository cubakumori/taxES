<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Info } from 'lucide-vue-next'

defineProps<{
  /** Texto breve que se muestra en el popover. */
  text: string
  /** Anchor del artículo en /conceptos (sin #), para el enlace "Leer más". */
  topic?: string
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

function toggle(e: MouseEvent): void {
  e.stopPropagation()
  open.value = !open.value
}

function onOutside(e: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onOutside)
  document.addEventListener('keydown', onEscape)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutside)
  document.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <span ref="root" class="relative inline-flex items-center gap-0.5">
    <slot />
    <button
      type="button"
      class="inline-flex p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
      aria-label="Más información"
      @click="toggle"
    >
      <Info class="w-3.5 h-3.5" />
    </button>
    <div
      v-if="open"
      class="absolute left-0 top-full mt-1 w-72 sm:w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-30 text-sm text-slate-700"
    >
      <p class="whitespace-pre-line leading-relaxed">{{ text }}</p>
      <RouterLink
        v-if="topic"
        :to="`/conceptos#${topic}`"
        class="mt-2 block text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Leer más en Conceptos →
      </RouterLink>
    </div>
  </span>
</template>
