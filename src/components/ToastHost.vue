<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { dismissToast, toasts } from '@/composables/useToast'
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-[72px] z-[120] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:top-20 md:items-end md:px-0">
      <TransitionGroup name="toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[10px] border bg-surface px-4 py-3 shadow-float"
          :class="{
            'border-success/40': item.type === 'success',
            'border-danger/40': item.type === 'error',
            'border-line': item.type === 'info',
          }"
          role="status"
        >
          <CircleCheck v-if="item.type === 'success'" :size="17" class="mt-0.5 shrink-0 text-success" />
          <CircleAlert v-else-if="item.type === 'error'" :size="17" class="mt-0.5 shrink-0 text-danger" />
          <Info v-else :size="17" class="mt-0.5 shrink-0 text-primary" />
          <p class="flex-1 text-[13.5px] leading-relaxed">{{ item.message }}</p>
          <button
            v-if="item.actionLabel"
            class="shrink-0 text-[12px] font-medium text-primary hover:underline"
            type="button"
            @click="item.onAction?.(); dismissToast(item.id)"
          >
            {{ item.actionLabel }}
          </button>
          <button
            class="shrink-0 text-dim transition-colors hover:text-ink"
            type="button"
            aria-label="关闭提示"
            @click="dismissToast(item.id)"
          >
            <X :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
