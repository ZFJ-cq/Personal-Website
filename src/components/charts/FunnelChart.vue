<script setup lang="ts">
import { computed } from 'vue'

interface Step {
  label: string
  value: number
  rate: number
}

const props = defineProps<{ steps: Step[] }>()

const max = computed(() => Math.max(1, ...props.steps.map((s) => s.value)))
</script>

<template>
  <ol class="space-y-2">
    <li v-for="(step, index) in steps" :key="step.label" class="flex items-center gap-3">
      <span class="num w-5 shrink-0 text-[10px] text-dim">{{ String(index + 1).padStart(2, '0') }}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-3 text-[11.5px]">
          <span>{{ step.label }}</span>
          <span class="num">
            {{ step.value }}
            <span class="ml-1 text-[10px] text-dim">{{ step.rate }}%</span>
          </span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-surface2">
          <div
            class="h-full rounded-full"
            :class="index === steps.length - 1 ? 'bg-success' : 'bg-primary'"
            :style="{ width: `${Math.max(2, (step.value / max) * 100)}%`, opacity: 1 - index * 0.12 }"
          />
        </div>
      </div>
    </li>
  </ol>
</template>
