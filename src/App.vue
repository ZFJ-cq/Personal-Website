<script setup lang="ts">
import { onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue'
import { CloudOff } from 'lucide-vue-next'
import { dbError, ensureDb } from '@/db'
import { useSiteStore } from '@/stores/site'
import ToastHost from '@/components/ToastHost.vue'
import CommandPalette from '@/components/CommandPalette.vue'

const site = useSiteStore()
const offline = ref(false)
const fatal = ref<Error | null>(null)

onErrorCaptured((error) => {
  fatal.value = error as Error
  console.error('[zf] 页面渲染失败', error)
  return false
})

function reload() {
  window.location.reload()
}

function syncNetwork() {
  offline.value = !navigator.onLine
}

onMounted(async () => {
  syncNetwork()
  window.addEventListener('online', syncNetwork)
  window.addEventListener('offline', syncNetwork)
  try {
    await ensureDb()
    await site.load(true)
  } catch {
    // 降级提示由页面自行处理
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('online', syncNetwork)
  window.removeEventListener('offline', syncNetwork)
})
</script>

<template>
  <div
    v-if="offline || dbError"
    class="border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-center text-[11.5px] text-warn"
    role="status"
  >
    <span class="inline-flex items-center gap-1.5">
      <CloudOff :size="13" />
      {{ offline ? '当前离线，已展示可用缓存内容。' : dbError }}
    </span>
  </div>

  <div v-if="fatal" class="wrap py-24 text-center">
    <p class="eyebrow">RUNTIME ERROR</p>
    <h1 class="display-lg mt-3">页面出了点问题</h1>
    <p class="mt-3 text-[13.5px] leading-relaxed text-dim">
      渲染时发生异常，内容已保护，没有丢失。可以刷新重试，或回到首页。
    </p>
    <pre
      v-if="fatal.message"
      class="num mx-auto mt-5 max-w-[560px] overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 text-left text-[11px] text-dim"
      >{{ fatal.message }}</pre
    >
    <div class="mt-7 flex justify-center gap-3">
      <button type="button" class="btn btn-primary" @click="reload">刷新页面</button>
      <RouterLink to="/" class="btn" @click="fatal = null">回到首页</RouterLink>
    </div>
  </div>

  <RouterView v-else />

  <CommandPalette />
  <ToastHost />
  <div class="grain no-print" aria-hidden="true" />
</template>
