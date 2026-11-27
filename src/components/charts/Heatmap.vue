<script setup lang="ts">
import type { HeatmapData } from '@/analytics/report'

const props = defineProps<{ data: HeatmapData }>()
const days = ['一', '二', '三', '四', '五', '六', '日']
const hours = Array.from({ length: 24 }, (_, i) => i)
const levels = [0.14, 0.34, 0.56, 0.78, 1]

function alpha(value: number): number {
  if (!value || !props.data.max) return 0
  return 0.1 + (value / props.data.max) * 0.8
}
</script>

<template>
  <div>
    <div class="overflow-x-auto">
      <div class="min-w-[560px]">
        <div class="flex items-end gap-1 pl-7">
          <span v-for="h in hours" :key="h" class="flex-1 text-center text-[8.5px] leading-none text-dim/70">
            {{ h % 3 === 0 ? h : '' }}
          </span>
        </div>
        <div v-for="(row, w) in data.matrix" :key="w" class="mt-1 flex items-center gap-1">
          <span class="num w-6 shrink-0 text-[9px] text-dim">{{ days[w] }}</span>
          <span
            v-for="(value, h) in row"
            :key="h"
            class="heat-cell h-[15px] flex-1 rounded-[2px] border border-line/25"
            :style="{ backgroundColor: value ? `rgb(var(--primary-rgb) / ${alpha(value).toFixed(2)})` : 'var(--surface-2)' }"
            :title="`周${days[w]} ${String(h).padStart(2, '0')}:00 · ${value} PV`"
          />
        </div>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-[10.5px] text-dim">按本地时间聚合，颜色越深访问越集中</p>
      <div class="flex items-center gap-1 text-[9px] text-dim">
        <span>少</span>
        <span
          v-for="level in levels"
          :key="level"
          class="h-2.5 w-2.5 rounded-[2px]"
          :style="{ backgroundColor: `rgb(var(--primary-rgb) / ${level})` }"
        />
        <span>多</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heat-cell {
  transition:
    transform 140ms ease,
    filter 140ms ease;
}
.heat-cell:hover {
  position: relative;
  z-index: 1;
  transform: scale(1.4);
  filter: brightness(1.25);
}
</style>
