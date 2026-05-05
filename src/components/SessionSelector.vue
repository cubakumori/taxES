<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ChevronDown, Download, Plus, Trash2, Upload } from 'lucide-vue-next'
import { useSessionStore } from '@stores/session'
import ConfirmDialog from './ConfirmDialog.vue'
import PassphraseDialog from './PassphraseDialog.vue'

const store = useSessionStore()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const activeSession = computed(() =>
  store.savedSessions.find((s) => s.id === store.activeSessionId),
)

const currentLabel = computed(() => {
  if (activeSession.value) return activeSession.value.label
  // Entre el alta del doc en memoria y el refresh de `savedSessions` tras el
  // auto-save hay un instante breve. Componemos el mismo label que escribiría
  // el guardado para no asustar al usuario con un "(sin guardar)" falso.
  if (store.hasAnyData && store.currentTaxYear && store.currentAccountId) {
    return `Renta ${store.currentTaxYear} · ${store.currentAccountId}`
  }
  return 'Sin sesión activa'
})

function toggle(): void {
  open.value = !open.value
}

function onClickOutside(e: MouseEvent): void {
  if (!open.value) return
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onEscape)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onEscape)
})

async function selectSession(id: string): Promise<void> {
  open.value = false
  await store.switchSession(id)
}

const pendingDeleteId = ref<string | null>(null)
const pendingDeleteLabel = ref<string>('')

function onDelete(id: string, event: MouseEvent): void {
  event.stopPropagation()
  const s = store.savedSessions.find((x) => x.id === id)
  pendingDeleteId.value = id
  pendingDeleteLabel.value = s?.label ?? id
  open.value = false // cierra el dropdown mientras se confirma
}

async function confirmDelete(): Promise<void> {
  if (!pendingDeleteId.value) return
  await store.deleteSession(pendingDeleteId.value)
  pendingDeleteId.value = null
}

function cancelDelete(): void {
  pendingDeleteId.value = null
}

async function onNew(): Promise<void> {
  open.value = false
  await store.newSession()
}

function onExport(): void {
  const json = store.exportSessionJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const label = activeSession.value?.label?.replace(/\s+/g, '-').toLowerCase() ?? 'sesion'
  a.href = url
  a.download = `taxes-${label}.json`
  a.click()
  URL.revokeObjectURL(url)
  open.value = false
}

function onImportClick(): void {
  fileInput.value?.click()
}

const pendingEncryptedText = ref<string | null>(null)
const decryptDialogOpen = ref(false)
const decryptBusy = ref(false)
const decryptError = ref<string | null>(null)

async function onImportChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  open.value = false
  const text = await file.text()
  const kind = store.detectImportKind(text)
  if (kind === 'encrypted') {
    pendingEncryptedText.value = text
    decryptError.value = null
    decryptDialogOpen.value = true
    return
  }
  if (kind === 'invalid') {
    window.alert(
      'El archivo no es un export reconocible de taxES (ni JSON plano ni backup cifrado).',
    )
    return
  }
  await store.importSessionJson(text)
}

async function onDecryptSubmit(passphrase: string): Promise<void> {
  if (!pendingEncryptedText.value) return
  decryptBusy.value = true
  decryptError.value = null
  try {
    await store.importSessionEncrypted(pendingEncryptedText.value, passphrase)
    decryptDialogOpen.value = false
    pendingEncryptedText.value = null
  } catch (err) {
    decryptError.value = err instanceof Error ? err.message : String(err)
  } finally {
    decryptBusy.value = false
  }
}

function onDecryptClose(value: boolean): void {
  if (value) return
  decryptDialogOpen.value = false
  pendingEncryptedText.value = null
}

function humanDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div ref="root" class="relative inline-block">
    <button
      type="button"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm"
      :class="{ 'bg-slate-50': open }"
      @click="toggle"
    >
      <span class="truncate max-w-[14rem] sm:max-w-[20rem]">{{ currentLabel }}</span>
      <ChevronDown
        class="w-4 h-4 text-slate-400 shrink-0 transition-transform"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-40 overflow-hidden"
    >
      <div
        class="text-[11px] text-slate-500 px-4 pt-3 pb-1 border-b border-slate-100 bg-slate-50"
      >
        Las sesiones se guardan automáticamente en este navegador.
      </div>
      <div class="p-2 max-h-72 overflow-y-auto">
        <div
          v-if="store.savedSessions.length === 0"
          class="text-sm text-slate-500 px-3 py-4 text-center"
        >
          Sin sesiones guardadas
        </div>
        <ul v-else class="space-y-0.5">
          <li
            v-for="s in store.savedSessions"
            :key="s.id"
            class="flex items-stretch gap-1 rounded-lg"
            :class="{ 'bg-slate-100': s.id === store.activeSessionId }"
          >
            <button
              type="button"
              class="flex-1 text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-3 min-w-0"
              @click="selectSession(s.id)"
            >
              <div
                class="w-2 h-2 rounded-full shrink-0"
                :class="s.id === store.activeSessionId ? 'bg-emerald-500' : 'bg-slate-300'"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-900 truncate">{{ s.label }}</div>
                <div class="text-xs text-slate-500">
                  Actualizada {{ humanDate(s.updatedAt) }}
                </div>
              </div>
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 shrink-0 self-center"
              :aria-label="`Eliminar ${s.label}`"
              @click="onDelete(s.id, $event)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </li>
        </ul>
      </div>
      <div class="border-t border-slate-200 p-2 space-y-0.5">
        <button
          type="button"
          class="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-slate-50 flex items-center gap-2"
          @click="onNew"
        >
          <Plus class="w-4 h-4 text-slate-500" />
          Nueva sesión
        </button>
        <button
          type="button"
          class="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-slate-50 flex items-center gap-2"
          @click="onImportClick"
        >
          <Upload class="w-4 h-4 text-slate-500" />
          Importar JSON
        </button>
        <button
          type="button"
          class="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          :disabled="!store.hasAnyData"
          @click="onExport"
        >
          <Download class="w-4 h-4 text-slate-500" />
          Exportar sesión actual
        </button>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json,.taxes-enc.json"
      class="hidden"
      @change="onImportChange"
    />

    <PassphraseDialog
      :open="decryptDialogOpen"
      mode="import"
      :error-message="decryptError"
      :busy="decryptBusy"
      @update:open="onDecryptClose"
      @submit="onDecryptSubmit"
    />

    <ConfirmDialog
      :open="pendingDeleteId !== null"
      title="Eliminar sesión"
      :message="`¿Quieres eliminar la sesión «${pendingDeleteLabel}»?\nEsta acción no se puede deshacer; los CSV habrá que volver a subirlos si la recuperas.`"
      confirm-label="Eliminar"
      danger
      @update:open="(v) => !v && cancelDelete()"
      @confirm="confirmDelete"
    />
  </div>
</template>
