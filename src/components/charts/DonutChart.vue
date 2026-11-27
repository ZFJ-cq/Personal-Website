<script setup lang="ts">
import { computed } from 'vue'

interface Slice {
  label: string
  value: number
  pct: number
}

const props = withDefaults(defineProps<{ slices: Slice[]; size?: number; unit?: string }>(), {
  size: 148,
  unit: 'PV',
})

const palette = ['var(--primary)', 'var(--success)', 'var(--warn)', '#8b5cf6', '#14b8a6', 'var(--danger)', 'var(--text-dim)']

const total = computed(() => props.slices.reduce((sum, slice) => sum + slice.value, 0))
const segments = computed(() => {
  let offset = 0
  return props.slices.map((slice, index) => {
    const dash = Math.max(0, slice.pct - 1.2)
    const segment = {
      ...slice,
      color: palette[index % palette.length],
      dash,
      offset: -offset,
    }
    offset += slice.pct
    return segment
  })
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-5">
    <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :viewBox="`0 0 ${size} ${size}`" class="h-full w-full -rotate-90" role="img" aria-label="占比环形图">
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="size / 2 - 10"
          fill="none"
          stroke="var(--surface-2)"
          :stroke-width="12"
        />
        <circle
          v-for="segment in segments"
          :key="segment.label"
          :cx="size / 2"
          :cy="size / 2"
          :r="size / 2 - 10"
          fill="none"
          :stroke="segment.color"
          :stroke-width="12"
          stroke-linecap="round"
          pathLength="100"
          :stroke-dasharray="`${segment.dash} ${100 - segment.dash}`"
          :stroke-dashoffset="segment.offset"
        />
      </svg>
      <div class="absolute inset-0 grid place-content-center text-center">
        <p class="num text-[20px] leading-none">{{ total }}</p>
        <p class="eyebrow mt-1 text-[8px]">{{ unit }}</p>
      </div>
    </div>
    <ul class="min-w-[120px] flex-1 space-y-1.5">
      <li v-for="segment in segments" :key="segment.label" class="flex items-center justify-between gap-3 text-[11.5px]">
        <span class="inline-flex min-w-0 items-center gap-1.5 text-dim">
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: segment.color }" />
          <span class="truncate">{{ segment.label }}</span>
        </span>
        <span class="num shrink-0">{{ segment.pct }}%</span>
      </li>
      <li v-if="!segments.length" class="text-[11.5px] text-dim">暂无数据</li>
    </ul>
  </div>
</template>
