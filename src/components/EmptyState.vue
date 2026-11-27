<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title: string
    description?: string
    actionText?: string
    to?: string
  }>(),
  { description: '', actionText: '', to: '' },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="card flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="mb-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface2 text-dim">
      <slot name="icon"><Inbox :size="20" /></slot>
    </div>
    <h3 class="text-[16px] font-semibold">{{ title }}</h3>
    <p v-if="description" class="mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-dim">{{ description }}</p>
    <RouterLink v-if="actionText && to" :to="to" class="btn btn-primary mt-6">{{ actionText }}</RouterLink>
    <button v-else-if="actionText" class="btn mt-6" type="button" @click="emit('action')">
      {{ actionText }}
    </button>
  </div>
</template>
