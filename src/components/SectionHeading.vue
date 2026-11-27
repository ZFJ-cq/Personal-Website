<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ index?: string; title: string; linkTo?: string; linkText?: string }>(), {
  index: '',
  linkTo: '',
  linkText: '查看全部',
})

const parts = computed(() => props.index.split('/').map((part) => part.trim()).filter(Boolean))
</script>

<template>
  <div class="mb-6 md:mb-8">
    <div class="flex items-center gap-3">
      <span v-if="parts.length" class="index-tag">{{ parts[0] }}</span>
      <span v-if="parts[1]" class="eyebrow text-[9.5px]">{{ parts[1] }}</span>
      <span class="hairline flex-1" />
      <span class="num hidden text-[9px] uppercase tracking-[0.2em] text-dim sm:block">ARCHIVE</span>
    </div>
    <div class="mt-3.5 flex flex-wrap items-end justify-between gap-4">
      <h2 class="display-md">{{ title }}</h2>
      <RouterLink
        v-if="linkTo"
        :to="linkTo"
        class="link-underline inline-flex items-center gap-1 text-sm text-dim transition-colors hover:text-primary"
      >
        {{ linkText }}
        <ArrowUpRight :size="15" />
      </RouterLink>
    </div>
  </div>
</template>
