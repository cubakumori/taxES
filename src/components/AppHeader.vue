<script setup lang="ts">
import { ref } from 'vue'
import { Menu } from 'lucide-vue-next'
import SessionSelector from './SessionSelector.vue'
import SideDrawer from './SideDrawer.vue'

const drawerOpen = ref(false)
</script>

<template>
  <header class="bg-white border-b border-slate-200 relative z-20 print:hidden">
    <div
      class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3"
    >
      <RouterLink to="/" class="flex items-baseline gap-3 min-w-0 no-underline">
        <h1 class="text-xl font-bold shrink-0 text-slate-900">taxES</h1>
        <p class="text-xs text-slate-500 hidden sm:block truncate">
          Renta Web desde Interactive Brokers
        </p>
      </RouterLink>
      <div class="flex items-center gap-2 shrink-0">
        <SessionSelector />
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
          aria-label="Abrir menú"
          @click="drawerOpen = true"
        >
          <Menu class="w-5 h-5" />
        </button>
      </div>
    </div>
    <SideDrawer v-model:open="drawerOpen" />
  </header>
</template>
