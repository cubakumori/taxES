<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Marca el botón principal como destructivo (rojo) y muestra icono de alerta. */
  danger?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

function onCancel(): void {
  emit('cancel')
  emit('update:open', false)
}
function onConfirm(): void {
  emit('confirm')
  emit('update:open', false)
}
function onBackdropClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) onCancel()
}
function onEscape(e: KeyboardEvent): void {
  if (props.open && e.key === 'Escape') onCancel()
}

onMounted(() => document.addEventListener('keydown', onEscape))
onUnmounted(() => document.removeEventListener('keydown', onEscape))
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
      class="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      @click="onBackdropClick"
    >
      <div
        class="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        role="alertdialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="flex items-start gap-3">
          <AlertTriangle
            v-if="danger"
            class="w-6 h-6 text-red-500 shrink-0 mt-0.5"
          />
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-lg text-slate-900">{{ title }}</h3>
            <p class="text-sm text-slate-600 mt-2 whitespace-pre-line">
              {{ message }}
            </p>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            @click="onCancel"
          >
            {{ cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg text-white"
            :class="
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-900 hover:bg-slate-800'
            "
            @click="onConfirm"
          >
            {{ confirmLabel ?? 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
