<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = withDefaults(defineProps<{ open: boolean; title?: string; wide?: boolean }>(), {
  title: '',
  wide: false,
})

const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
let previousOverflow = ''

useFocusTrap(() => panel.value, toRef(props, 'open'))

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKey)
      await nextTick()
      panel.value?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-[2px] md:items-center md:p-6"
        @mousedown.self="emit('close')"
      >
        <div
          ref="panel"
          class="max-h-[90dvh] w-full overflow-y-auto rounded-t-[16px] border border-line bg-bg shadow-modal outline-none md:rounded-[16px]"
          :class="wide ? 'md:max-w-[880px]' : 'md:max-w-[560px]'"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '对话框'"
          tabindex="-1"
        >
          <div class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg/95 px-5 py-4 backdrop-blur">
            <h2 class="text-[15px] font-semibold">{{ title }}</h2>
            <button class="icon-btn !h-9 !w-9" type="button" aria-label="关闭" @click="emit('close')">
              <X :size="17" />
            </button>
          </div>
          <div class="p-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div,
.modal-leave-to > div {
  transform: translateY(18px);
}
@media (min-width: 768px) {
  .modal-enter-from > div,
  .modal-leave-to > div {
    transform: translateY(8px) scale(0.985);
  }
}
</style>
