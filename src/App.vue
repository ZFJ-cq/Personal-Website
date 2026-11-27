<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CloudOff } from 'lucide-vue-next'
import { dbError, ensureDb } from '@/db'
import { useSiteStore } from '@/stores/site'
import ToastHost from '@/components/ToastHost.vue'
import CommandPalette from '@/components/CommandPalette.vue'

const site = useSiteStore()
const offline = ref(false)

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

  <RouterView />

  <CommandPalette />
  <ToastHost />
  <div class="grain no-print" aria-hidden="true" />
</template>
