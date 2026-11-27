<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { copyText } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ source?: string | null }>()

const root = ref<HTMLElement | null>(null)
const html = computed(() => renderMarkdown(props.source))

const lightbox = ref<{ images: string[]; index: number } | null>(null)

function onContainerClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const copyButton = target.closest<HTMLButtonElement>('.code-copy')
  if (copyButton) {
    const code = copyButton.parentElement?.querySelector('code')?.textContent ?? ''
    void copyText(code).then(() => {
      copyButton.textContent = '已复制'
      window.setTimeout(() => {
        copyButton.textContent = '复制'
      }, 1600)
    })
    return
  }

  if (target.tagName === 'IMG') {
    const images = Array.from(root.value?.querySelectorAll('img') ?? [])
      .map((img) => img.getAttribute('src') || '')
      .filter(Boolean)
    const src = target.getAttribute('src') || ''
    const index = Math.max(0, images.indexOf(src))
    lightbox.value = { images, index }
  }
}

function closeLightbox() {
  lightbox.value = null
}

function step(delta: number) {
  if (!lightbox.value) return
  const total = lightbox.value.images.length
  if (!total) return
  lightbox.value = { ...lightbox.value, index: (lightbox.value.index + delta + total) % total }
}

function onKey(event: KeyboardEvent) {
  if (!lightbox.value) return
  if (event.key === 'Escape') closeLightbox()
  if (event.key === 'ArrowRight') step(1)
  if (event.key === 'ArrowLeft') step(-1)
}

watch(lightbox, (value) => {
  if (value) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
  document.body.style.overflow = value ? 'hidden' : ''
})

watch(
  () => props.source,
  () => {
    if (lightbox.value) closeLightbox()
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div ref="root" class="prose-md break-anywhere" @click="onContainerClick" v-html="html" />

  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="lightbox"
        class="fixed inset-0 z-[125] flex flex-col bg-black/85 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="closeLightbox"
      >
        <div class="flex items-center justify-between px-4 py-3 text-white/70">
          <span class="num text-xs">{{ lightbox.index + 1 }} / {{ lightbox.images.length }}</span>
          <button
            type="button"
            class="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
            aria-label="关闭预览"
            @click="closeLightbox"
          >
            <X :size="20" />
          </button>
        </div>
        <div class="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-6">
          <button
            v-if="lightbox.images.length > 1"
            type="button"
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="上一张"
            @click.stop="step(-1)"
          >
            <ChevronLeft :size="24" />
          </button>
          <img
            :src="lightbox.images[lightbox.index]"
            alt="预览图"
            class="max-h-full max-w-full rounded-lg object-contain shadow-modal"
            @click.stop
          />
          <button
            v-if="lightbox.images.length > 1"
            type="button"
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="下一张"
            @click.stop="step(1)"
          >
            <ChevronRight :size="24" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 200ms ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
