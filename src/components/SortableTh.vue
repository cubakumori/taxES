<script setup lang="ts" generic="T extends string">
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-vue-next'

const props = defineProps<{
  field: T
  current: T
  dir: 'asc' | 'desc'
  align?: 'left' | 'right'
}>()

const emit = defineEmits<{ sort: [field: T] }>()
</script>

<template>
  <th
    :class="[
      'cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100',
      props.align === 'left' ? 'text-left pr-4' : 'text-right pr-4',
    ]"
    @click="emit('sort', props.field)"
  >
    <span class="inline-flex items-center gap-1">
      <slot />
      <ChevronUp v-if="current === field && dir === 'asc'" class="w-3 h-3" />
      <ChevronDown v-else-if="current === field && dir === 'desc'" class="w-3 h-3" />
      <ChevronsUpDown v-else class="w-3 h-3 text-slate-300 dark:text-slate-600" />
    </span>
  </th>
</template>
