<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Moon, Search, Sun, X } from 'lucide-vue-next'
import { useSiteStore } from '@/stores/site'
import { useTheme } from '@/composables/useTheme'
import { useFocusTrap } from '@/composables/useFocusTrap'

const route = useRoute()
const site = useSiteStore()
const { theme, toggleTheme } = useTheme()

const scrolled = ref(false)
const drawer = ref(false)
const drawerPanel = ref<HTMLElement | null>(null)

useFocusTrap(() => drawerPanel.value, drawer)

const nav = [
  { label: '作品', to: '/works' },
  { label: 'App', to: '/apps' },
  { label: '关于', to: '/about' },
  { label: '简历', to: '/resume' },
]

const name = computed(() => site.profile.name || '张福建')

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path === to || route.path.startsWith(`${to}/`)
}

function openSearch() {
  drawer.value = false
  window.dispatchEvent(new Event('zf:command'))
}

let scrollRaf = 0

function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    scrolled.value = window.scrollY > 16
  })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') drawer.value = false
}

watch(drawer, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

watch(
  () => route.fullPath,
  () => {
    drawer.value = false
  },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKey)
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKey)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  document.body.style.overflow = ''
})
</script>

<template>
  <header
    class="no-print sticky top-0 z-[90] border-b transition-all duration-300"
    :class="scrolled ? 'border-line bg-bg/80 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl' : 'border-transparent bg-transparent'"
  >
    <div class="wrap flex h-16 items-center justify-between gap-4">
      <RouterLink to="/" class="group flex items-center gap-2.5" aria-label="返回首页">
        <span
          class="grid h-8 w-8 place-items-center rounded-[9px] border border-primary/35 bg-gradient-to-br from-primary/25 to-primary/5 text-[12px] font-semibold tracking-tight text-primary shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-colors group-hover:border-primary/60"
        >
          ZF
        </span>
        <span class="leading-none">
          <span class="font-display block text-[16px] tracking-tight">{{ name }}</span>
          <span class="eyebrow mt-1 hidden text-[9px] sm:block">TECHNICAL DOSSIER</span>
        </span>
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex" aria-label="主导航">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="relative rounded-md px-3 py-2 text-[13.5px] transition-colors"
          :class="isActive(item.to) ? 'text-ink' : 'text-dim hover:text-ink'"
        >
          {{ item.label }}
          <span
            v-if="isActive(item.to)"
            class="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent"
            aria-hidden="true"
          />
        </RouterLink>
      </nav>

      <div class="flex items-center gap-0.5">
        <button type="button" class="icon-btn !h-10 !w-10" aria-label="搜索（⌘K）" @click="openSearch">
          <Search :size="17" />
        </button>
        <button
          type="button"
          class="icon-btn !h-10 !w-10"
          :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          @click="toggleTheme"
        >
          <Sun v-if="theme === 'dark'" :size="17" />
          <Moon v-else :size="17" />
        </button>
        <button
          type="button"
          class="icon-btn !h-10 !w-10 md:hidden"
          aria-label="打开菜单"
          :aria-expanded="drawer"
          @click="drawer = true"
        >
          <Menu :size="19" />
        </button>
      </div>
    </div>
  </header>

  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="drawer" class="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="站点菜单">
        <div class="absolute inset-0 bg-black/55 backdrop-blur-[2px]" @click="drawer = false" />
        <aside
          ref="drawerPanel"
          class="absolute right-0 top-0 flex h-full w-[86%] max-w-[340px] flex-col border-l border-line bg-bg p-5 shadow-modal safe-bottom"
        >
          <div class="flex items-center justify-between">
            <span class="eyebrow">NAVIGATION</span>
            <button type="button" class="icon-btn !h-10 !w-10" aria-label="关闭菜单" @click="drawer = false">
              <X :size="19" />
            </button>
          </div>

          <nav class="mt-8 flex flex-col gap-1" aria-label="移动端主导航">
            <RouterLink
              v-for="(item, i) in nav"
              :key="item.to"
              :to="item.to"
              class="flex items-baseline justify-between rounded-lg px-3 py-3 transition-colors"
              :class="isActive(item.to) ? 'bg-surface2 text-ink' : 'text-dim hover:bg-surface hover:text-ink'"
            >
              <span class="font-display text-[22px]">{{ item.label }}</span>
              <span class="num text-[10px] text-dim">0{{ i + 1 }}</span>
            </RouterLink>
            <RouterLink to="/admin" class="mt-2 rounded-lg px-3 py-2.5 text-[13px] text-dim hover:text-ink">
              内容管理后台 →
            </RouterLink>
          </nav>

          <div class="mt-auto space-y-3 border-t border-line pt-5">
            <button type="button" class="btn w-full justify-start" @click="openSearch">
              <Search :size="16" /> 搜索作品与 App
            </button>
            <button type="button" class="btn w-full justify-start" @click="toggleTheme">
              <Sun v-if="theme === 'dark'" :size="16" />
              <Moon v-else :size="16" />
              {{ theme === 'dark' ? '切换到浅色' : '切换到深色' }}
            </button>
            <p class="eyebrow text-[9px]">ZF / ARCHIVE · {{ new Date().getFullYear() }}</p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 220ms ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
