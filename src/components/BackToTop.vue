<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowUp } from 'lucide-vue-next'

const visible = ref(false)
function onScroll() {
  visible.value = window.scrollY > 600
}
function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="fade">
    <button
      v-if="visible"
      type="button"
      aria-label="回到顶部"
      class="no-print fixed right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/90 text-dim shadow-float backdrop-blur transition-colors hover:border-primary/45 hover:text-primary"
      style="bottom: calc(24px + env(safe-area-inset-bottom, 0px))"
      @click="toTop"
    >
      <ArrowUp :size="18" />
    </button>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
