<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '@stores/session'
import AppHeader from '@components/AppHeader.vue'

const store = useSessionStore()
onMounted(() => {
  void store.init()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <AppHeader />
    <RouterView />
  </div>
</template>
