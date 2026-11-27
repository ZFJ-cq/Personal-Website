<script setup lang="ts">
import { computed } from 'vue'
import type { WorkWithTags } from '@/db/types'
import { CONCLUSION_LABEL, parseAppMeta } from '@/db/types'
import { formatNumber } from '@/lib/utils'
import ImageWithFallback from './ImageWithFallback.vue'

const props = defineProps<{ work: WorkWithTags }>()
const meta = computed(() => parseAppMeta(props.work.meta))
const letter = computed(() => props.work.title.slice(0, 1))
const level = computed(() => meta.value.conclusion_level ?? 'pass')
</script>

<template>
  <RouterLink
    :to="`/apps/${work.slug}`"
    class="card card-hover group flex h-full items-stretch gap-4 p-4 md:p-5"
  >
    <div
      class="app-icon relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-line bg-surface2 transition-colors duration-200 group-hover:border-primary/35 md:h-[76px] md:w-[76px]"
    >
      <span class="pointer-events-none absolute inset-0 grid place-items-center font-display text-[22px] text-dim/60" aria-hidden="true">
        {{ letter }}
      </span>
      <ImageWithFallback :src="work.cover_url" :alt="`${work.title} 图标`" :letter="letter" />
      <span class="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-inset ring-white/5" aria-hidden="true" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 text-[15px] font-semibold leading-snug transition-colors group-hover:text-primary md:text-[16px]">
          {{ work.title }}
        </h3>
        <span class="badge shrink-0" :class="`badge-${level}`">{{ CONCLUSION_LABEL[level] }}</span>
      </div>

      <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="eyebrow">{{ (meta.platforms ?? []).join(' / ') || 'H5' }}</span>
        <span v-if="meta.version" class="eyebrow">v{{ meta.version }}</span>
      </div>

      <div class="mt-2 flex flex-wrap gap-1">
        <span v-for="t in meta.test_types.slice(0, 3)" :key="t" class="chip chip-testtype">{{ t }}</span>
      </div>

      <div class="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-line/70 pt-3">
        <div class="flex items-baseline gap-4">
          <div>
            <div class="num text-[19px] leading-none">{{ formatNumber(meta.case_count) }}</div>
            <div class="mt-1 text-[11px] text-dim">用例</div>
          </div>
          <div>
            <div class="num text-[19px] leading-none">
              {{ formatNumber(meta.bug_total) }}
              <span v-if="meta.bug_p0" class="text-[12px] text-danger">/ P0 {{ meta.bug_p0 }}</span>
            </div>
            <div class="mt-1 text-[11px] text-dim">缺陷</div>
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.app-icon :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 8px;
}
</style>
