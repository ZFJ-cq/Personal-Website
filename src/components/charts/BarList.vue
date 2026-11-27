<script setup lang="ts">
interface Row {
  label: string
  value: number
  pct: number
  meta?: string
}

withDefaults(defineProps<{ rows: Row[]; color?: string; unit?: string }>(), {
  color: 'var(--primary)',
  unit: '',
})
</script>

<template>
  <ul class="space-y-2.5">
    <li v-for="row in rows" :key="row.label">
      <div class="flex items-baseline justify-between gap-3 text-[11.5px]">
        <span class="inline-flex min-w-0 items-baseline gap-2">
          <span class="truncate text-ink">{{ row.label }}</span>
          <span v-if="row.meta" class="num shrink-0 text-[10px] text-dim">{{ row.meta }}</span>
        </span>
        <span class="num shrink-0 text-dim">{{ row.value }}{{ unit }}</span>
      </div>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
        <div class="h-full rounded-full transition-[width] duration-500" :style="{ width: `${Math.max(2, row.pct)}%`, background: color }" />
      </div>
    </li>
    <li v-if="!rows.length" class="py-4 text-center text-[11.5px] text-dim">暂无数据</li>
  </ul>
</template>
