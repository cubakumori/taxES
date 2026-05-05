<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Eye, EyeOff, KeyRound, X } from 'lucide-vue-next'
import { MIN_PASSPHRASE_LENGTH } from '@lib/crypto/envelope'

const props = defineProps<{
  open: boolean
  mode: 'export' | 'import'
  title?: string
  /** Mensaje bajo el input (p. ej. «passphrase incorrecta») entre intentos. */
  errorMessage?: string | null
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [passphrase: string]
}>()

const passphrase = ref('')
const confirm = ref('')
const show = ref(false)
const firstInput = ref<HTMLInputElement | null>(null)

const defaultTitle = computed(() =>
  props.mode === 'export'
    ? 'Cifrar sesión con passphrase'
    : 'Descifrar backup',
)

const mismatch = computed(
  () => props.mode === 'export' && confirm.value !== '' && confirm.value !== passphrase.value,
)

const canSubmit = computed(() => {
  if (props.busy) return false
  if (passphrase.value.length < MIN_PASSPHRASE_LENGTH) return false
  if (props.mode === 'export' && confirm.value !== passphrase.value) return false
  return true
})

function close(): void {
  if (props.busy) return
  emit('update:open', false)
}

function onSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', passphrase.value)
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
  if (e.key === 'Enter' && canSubmit.value) onSubmit()
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      passphrase.value = ''
      confirm.value = ''
      show.value = false
      await nextTick()
      firstInput.value?.focus()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      @click.self="close"
      @keydown="onKey"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200">
        <div class="flex items-start justify-between p-5 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <KeyRound class="w-5 h-5 text-slate-500" />
            <h2 class="text-lg font-semibold text-slate-900">
              {{ title || defaultTitle }}
            </h2>
          </div>
          <button
            type="button"
            class="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            aria-label="Cerrar"
            :disabled="busy"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-4">
          <p v-if="mode === 'export'" class="text-sm text-slate-600">
            El archivo resultante se cifra con <strong>AES-GCM-256</strong> y una clave derivada
            de tu passphrase con PBKDF2 (600 000 iteraciones). Podrás guardarlo en Drive, USB
            o donde prefieras; solo con esta passphrase se puede abrir.
          </p>
          <p v-else class="text-sm text-slate-600">
            Introduce la passphrase con la que cifraste este backup.
          </p>

          <label class="block">
            <span class="text-xs font-medium text-slate-700">Passphrase</span>
            <div class="mt-1 relative">
              <input
                ref="firstInput"
                v-model="passphrase"
                :type="show ? 'text' : 'password'"
                :placeholder="
                  mode === 'export' ? `mínimo ${MIN_PASSPHRASE_LENGTH} caracteres` : ''
                "
                autocomplete="off"
                spellcheck="false"
                class="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none text-sm font-mono"
                :disabled="busy"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
                :aria-label="show ? 'Ocultar passphrase' : 'Mostrar passphrase'"
                tabindex="-1"
                @click="show = !show"
              >
                <EyeOff v-if="show" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </label>

          <label v-if="mode === 'export'" class="block">
            <span class="text-xs font-medium text-slate-700">Repite la passphrase</span>
            <input
              v-model="confirm"
              :type="show ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none text-sm font-mono"
              :class="{ 'border-red-400 focus:border-red-500': mismatch }"
              :disabled="busy"
            />
            <span v-if="mismatch" class="text-xs text-red-600 mt-1 inline-block">
              No coinciden
            </span>
          </label>

          <div
            v-if="errorMessage"
            class="text-sm bg-red-50 border border-red-100 text-red-900 rounded-lg p-3"
          >
            {{ errorMessage }}
          </div>

          <div
            v-if="mode === 'export'"
            class="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3"
          >
            <strong>Importante:</strong> si pierdes la passphrase no se puede recuperar el
            contenido. Guárdala en un gestor de contraseñas.
          </div>
        </div>

        <div class="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
            :disabled="busy"
            @click="close"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            <template v-if="busy">Procesando…</template>
            <template v-else>
              {{ mode === 'export' ? 'Cifrar y descargar' : 'Descifrar' }}
            </template>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
