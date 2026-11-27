<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CornerDownLeft, Search } from 'lucide-vue-next'
import { listWorks } from '@/api/works'
import type { WorkWithTags } from '@/db/types'

interface PaletteItem {
  label: string
  sub: string
  to: string
  group: string
}

const router = useRouter()
const open = ref(false)
const query = ref('')
const cursor = ref(0)
const input = ref<HTMLInputElement | null>(null)
const works = ref<WorkWithTags[]>([])
const apps = ref<WorkWithTags[]>([])
let loaded = false

const pages: PaletteItem[] = [
  { label: '首页', sub: 'Hero / 精选 / 联系方式', to: '/', group: '页面' },
  { label: '作品集', sub: '全部作品与筛选', to: '/works', group: '页面' },
  { label: '测试过的 App', sub: '测试履历与缺陷数据', to: '/apps', group: '页面' },
  { label: '关于', sub: '经历与技能', to: '/about', group: '页面' },
  { label: '简历', sub: '可打印版本', to: '/resume', group: '页面' },
  { label: '后台', sub: '内容管理', to: '/admin', group: '页面' },
]

const allItems = computed<PaletteItem[]>(() => [
  ...works.value.map((w) => ({
    label: w.title,
    sub: [w.category, w.subtitle].filter(Boolean).join(' · '),
    to: `/works/${w.slug}`,
    group: '作品',
  })),
  ...apps.value.map((w) => ({
    label: w.title,
    sub: ['被测 App', w.category].filter(Boolean).join(' · '),
    to: `/apps/${w.slug}`,
    group: 'App',
  })),
  ...pages,
])

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allItems.value.slice(0, 8)
  return allItems.value
    .filter((item) => `${item.label} ${item.sub}`.toLowerCase().includes(q))
    .slice(0, 10)
})

async function loadItems() {
  if (loaded) return
  loaded = true
  try {
    const [workList, appList] = await Promise.all([
      listWorks({ kind: 'work', limit: 60 }),
      listWorks({ kind: 'app', limit: 60 }),
    ])
    works.value = workList
    apps.value = appList
  } catch {
    loaded = false
  }
}

async function show() {
  open.value = true
  query.value = ''
  cursor.value = 0
  await loadItems()
  await nextTick()
  input.value?.focus()
}

function close() {
  open.value = false
}

function go(item: PaletteItem | undefined) {
  if (!item) return
  close()
  router.push(item.to)
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value ? close() : show()
    return
  }
  if (!open.value) return
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    cursor.value = (cursor.value + 1) % Math.max(results.value.length, 1)
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    cursor.value = (cursor.value - 1 + results.value.length) % Math.max(results.value.length, 1)
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    go(results.value[cursor.value])
  }
}

watch(query, () => {
  cursor.value = 0
})

watch(open, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('zf:command', show)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('zf:command', show as EventListener)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div
        v-if="open"
        class="fixed inset-0 z-[130] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-[3px]"
        @mousedown.self="close"
      >
        <div class="w-full max-w-[600px] overflow-hidden rounded-[14px] border border-line bg-bg shadow-modal">
          <div class="flex items-center gap-3 border-b border-line px-4">
            <Search :size="17" class="shrink-0 text-dim" />
            <input
              ref="input"
              v-model="query"
              class="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim/70"
              placeholder="搜作品、App 或跳转页面…"
              aria-label="全局搜索"
              autocomplete="off"
            />
            <kbd class="hidden rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] text-dim xs:block">ESC</kbd>
          </div>

          <div class="max-h-[56vh] overflow-y-auto p-2">
            <p v-if="!results.length" class="px-3 py-8 text-center text-[13px] text-dim">
              没有匹配项，换个关键词试试
            </p>
            <button
              v-for="(item, i) in results"
              :key="item.to + item.label"
              type="button"
              class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left transition-colors"
              :class="i === cursor ? 'bg-surface2' : 'hover:bg-surface'"
              @mouseenter="cursor = i"
              @click="go(item)"
            >
              <span class="eyebrow w-10 shrink-0">{{ item.group }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-medium">{{ item.label }}</span>
                <span class="block truncate text-[11.5px] text-dim">{{ item.sub }}</span>
              </span>
              <CornerDownLeft v-if="i === cursor" :size="14" class="shrink-0 text-dim" />
            </button>
          </div>

          <div class="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11px] text-dim">
            <span class="num">↑ ↓ 选择 · ↵ 打开</span>
            <span class="num">⌘K 随时唤起</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-enter-active,
.palette-leave-active {
  transition: opacity 160ms ease;
}
.palette-enter-active > div,
.palette-leave-active > div {
  transition: transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}
.palette-enter-from > div,
.palette-leave-to > div {
  transform: translateY(-8px) scale(0.99);
}
</style>
