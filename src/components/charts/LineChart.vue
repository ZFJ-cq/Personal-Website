<script setup lang="ts">
import { computed, ref } from 'vue'

interface Series {
  name: string
  color: string
  values: number[]
  dash?: boolean
}

const props = withDefaults(
  defineProps<{
    series: Series[]
    labels: string[]
    height?: number
  }>(),
  { height: 220 },
)

const W = 720
const H = computed(() => props.height)
const pad = { top: 16, right: 14, bottom: 28, left: 40 }
const active = ref<number | null>(null)
const wrap = ref<HTMLElement | null>(null)

const maxValue = computed(() => {
  const values = props.series.flatMap((s) => s.values)
  return Math.max(1, ...values)
})

const ticks = computed(() => {
  const max = maxValue.value
  return Array.from({ length: 4 }, (_, i) => Math.round((max / 3) * (3 - i)))
})

function x(index: number): number {
  const count = Math.max(1, props.labels.length - 1)
  return pad.left + (index / count) * (W - pad.left - pad.right)
}

function y(value: number): number {
  return pad.top + (1 - value / maxValue.value) * (H.value - pad.top - pad.bottom)
}

function path(values: number[]): string {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
}

function area(values: number[]): string {
  if (!values.length) return ''
  const base = H.value - pad.bottom
  return `${path(values)} L${x(values.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`
}

function onMove(event: MouseEvent) {
  if (!wrap.value || !props.labels.length) return
  const rect = wrap.value.getBoundingClientRect()
  const ratio = (event.clientX - rect.left) / rect.width
  const inner = Math.min(1, Math.max(0, (ratio * W - pad.left) / (W - pad.left - pad.right)))
  active.value = Math.round(inner * (props.labels.length - 1))
}

const activeValues = computed(() =>
  active.value === null
    ? []
    : props.series.map((s) => ({ name: s.name, color: s.color, value: s.values[active.value as number] ?? 0 })),
)

const tooltipStyle = computed(() => {
  if (active.value === null) return {}
  const percent = (x(active.value) / W) * 100
  return {
    left: `${Math.min(82, Math.max(4, percent))}%`,
  }
})
</script>

<template>
  <div ref="wrap" class="relative w-full" @mousemove="onMove" @mouseleave="active = null">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full overflow-visible" role="img" aria-label="访问趋势图">
      <g>
        <line
          v-for="(tick, i) in ticks"
          :key="tick"
          :x1="pad.left"
          :x2="W - pad.right"
          :y1="y(tick)"
          :y2="y(tick)"
          stroke="var(--border)"
          stroke-width="1"
          :stroke-dasharray="i === ticks.length - 1 ? '0' : '3 5'"
          opacity="0.7"
        />
        <text
          v-for="tick in ticks"
          :key="`label-${tick}`"
          :x="pad.left - 8"
          :y="y(tick) + 3"
          text-anchor="end"
          font-size="10"
          fill="var(--text-dim)"
          font-family="SFMono-Regular, Menlo, monospace"
        >
          {{ tick }}
        </text>
      </g>

      <g v-if="series.length && labels.length">
        <path
          v-for="(s, i) in series"
          v-show="i === 0"
          :key="`area-${s.name}`"
          :d="area(s.values)"
          :fill="s.color"
          opacity="0.08"
        />
        <path
          v-for="s in series"
          :key="`path-${s.name}`"
          :d="path(s.values)"
          fill="none"
          :stroke="s.color"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          :stroke-dasharray="s.dash ? '5 4' : undefined"
        />
        <g v-for="s in series" :key="`dot-${s.name}`">
          <circle
            v-if="s.values.length"
            :cx="x(s.values.length - 1)"
            :cy="y(s.values[s.values.length - 1])"
            r="2.6"
            :fill="s.color"
          />
        </g>
      </g>

      <g v-if="active !== null && labels.length">
        <line
          :x1="x(active)"
          :x2="x(active)"
          :y1="pad.top"
          :y2="H - pad.bottom"
          stroke="var(--primary)"
          stroke-width="1"
          stroke-dasharray="3 4"
          opacity="0.6"
        />
        <circle
          v-for="s in series"
          :key="`active-${s.name}`"
          :cx="x(active)"
          :cy="y(s.values[active] ?? 0)"
          r="3.4"
          fill="var(--bg)"
          :stroke="s.color"
          stroke-width="2"
        />
      </g>

      <g>
        <text
          v-for="(label, index) in labels"
          :key="label"
          :x="x(index)"
          :y="H - 8"
          text-anchor="middle"
          font-size="9.5"
          fill="var(--text-dim)"
          font-family="SFMono-Regular, Menlo, monospace"
        >
          {{ label }}
        </text>
      </g>
    </svg>

    <div
      v-if="active !== null"
      class="pointer-events-none absolute top-1 z-10 min-w-[120px] -translate-x-1/2 rounded-lg border border-line bg-bg/95 px-2.5 py-2 text-[10.5px] shadow-float backdrop-blur"
      :style="tooltipStyle"
    >
      <p class="num mb-1 text-dim">{{ labels[active] }}</p>
      <p v-for="item in activeValues" :key="item.name" class="flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full" :style="{ background: item.color }" />
          {{ item.name }}
        </span>
        <span class="num">{{ item.value }}</span>
      </p>
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-4 text-[10.5px] text-dim">
      <span v-for="s in series" :key="`legend-${s.name}`" class="inline-flex items-center gap-1.5">
        <span class="h-[2px] w-4 rounded" :style="{ background: s.color }" />
        {{ s.name }}
      </span>
    </div>
  </div>
</template>
