<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import type { WorkWithTags } from '@/db/types'
import { formatDate } from '@/lib/utils'
import ImageWithFallback from './ImageWithFallback.vue'
import StatusBadge from './StatusBadge.vue'
import TagPill from './TagPill.vue'

const props = withDefaults(defineProps<{ work: WorkWithTags; eager?: boolean; index?: number }>(), {
  eager: false,
  index: 0,
})

const finished = computed(() => (props.work.finished_at ? formatDate(props.work.finished_at, 'YYYY.MM') : '进行中'))
const letter = computed(() => props.work.title.slice(0, 1))
const visibleTags = computed(() => props.work.tags.slice(0, 3))
</script>

<template>
  <RouterLink :to="`/works/${work.slug}`" class="card card-hover group flex flex-col overflow-hidden">
    <div class="cover">
      <ImageWithFallback :src="work.cover_url" :alt="`${work.title} 封面`" :letter="letter" :eager="eager" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" aria-hidden="true" />

      <div class="absolute left-3 top-3 flex gap-2">
        <StatusBadge v-if="work.status === 'wip'" :status="work.status" />
        <span v-if="work.featured" class="badge badge-conditional backdrop-blur-sm">精选</span>
      </div>
      <span
        v-if="index"
        class="num absolute right-3 top-3 rounded-md border border-white/15 bg-black/35 px-1.5 py-0.5 text-[10px] text-white/75 backdrop-blur-sm"
      >
        {{ String(index).padStart(2, '0') }}
      </span>

      <div class="absolute inset-x-3.5 bottom-3 flex items-end justify-between gap-3">
        <span class="eyebrow !text-white/80">{{ work.category || 'PROJECT' }}</span>
        <span class="num text-[10px] text-white/65">{{ finished }}</span>
      </div>
    </div>

    <div class="flex flex-1 flex-col p-4 md:p-5">
      <h3 class="text-[18px] font-semibold leading-snug transition-colors duration-200 group-hover:text-primary">
        {{ work.title }}
      </h3>
      <p v-if="work.subtitle" class="mt-1.5 line-clamp-2 min-h-[2.9em] text-[13.5px] leading-relaxed text-dim">
        {{ work.subtitle }}
      </p>

      <div class="mt-auto flex items-end justify-between gap-3 pt-4">
        <div class="flex flex-wrap gap-1.5">
          <TagPill v-for="tag in visibleTags" :key="tag.id" :name="tag.name" :kind="tag.kind" />
          <span v-if="work.tags.length > 3" class="chip">+{{ work.tags.length - 3 }}</span>
        </div>
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-dim transition-all duration-200 group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:text-primary"
          aria-hidden="true"
        >
          <ArrowRight :size="15" />
        </span>
      </div>
    </div>
  </RouterLink>
</template>
