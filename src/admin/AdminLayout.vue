<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowUpRight,
  BarChart3,
  Database,
  FolderKanban,
  HardDriveDownload,
  LayoutDashboard,
  LogOut,
  Plug,
  Rocket,
  Settings,
  Smartphone,
  Tags,
} from 'lucide-vue-next'
import { dbMode } from '@/db'
import { logout } from '@/composables/useAuth'
import { useSiteStore } from '@/stores/site'
import { pushToast } from '@/composables/useToast'
import { publishedRevision, loadPublishedRevision } from '@/composables/usePublish'
import PublishDialog from '@/admin/PublishDialog.vue'

const route = useRoute()
const router = useRouter()
const site = useSiteStore()

const nav = [
  { label: '概览', to: '/admin', name: 'admin-dashboard', icon: LayoutDashboard },
  { label: '作品', to: '/admin/works', name: 'admin-works', icon: FolderKanban },
  { label: 'App', to: '/admin/apps', name: 'admin-apps', icon: Smartphone },
  { label: '标签', to: '/admin/tags', name: 'admin-tags', icon: Tags },
  { label: '统计', to: '/admin/analytics', name: 'admin-analytics', icon: BarChart3 },
  { label: '设置', to: '/admin/settings', name: 'admin-settings', icon: Settings },
  { label: '数据', to: '/admin/data', name: 'admin-data', icon: HardDriveDownload },
  { label: '连接', to: '/admin/connect', name: 'admin-connect', icon: Plug },
]

const mobileNav = nav.filter((item) => ['admin-dashboard', 'admin-works', 'admin-apps', 'admin-analytics', 'admin-settings'].includes(item.name))

const titleMap: Record<string, string> = {
  'admin-dashboard': '概览',
  'admin-works': '作品管理',
  'admin-work-new': '新建作品',
  'admin-work-edit': '编辑作品',
  'admin-apps': 'App 管理',
  'admin-app-new': '新建 App',
  'admin-app-edit': '编辑 App',
  'admin-tags': '标签管理',
  'admin-analytics': '访客统计',
  'admin-settings': '站点设置',
  'admin-data': '数据管理',
  'admin-connect': '数据源连接',
}

const title = computed(() => titleMap[String(route.name)] || '内容后台')
const revision = computed(() => site.settings.contentRevision || 0)
const pending = computed(() => Math.max(0, revision.value - publishedRevision.value))
const publishOpen = ref(false)

function openPublish() {
  publishOpen.value = true
}

function onPublishKey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
    event.preventDefault()
    openPublish()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onPublishKey)
  window.addEventListener('zf:publish', openPublish)
  void loadPublishedRevision()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPublishKey)
  window.removeEventListener('zf:publish', openPublish)
})

function isActive(item: (typeof nav)[number]): boolean {
  if (item.name === 'admin-dashboard') return route.name === 'admin-dashboard'
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function doLogout() {
  logout()
  pushToast('已退出后台', 'info')
  router.replace('/admin/login')
}
</script>

<template>
  <div class="min-h-dvh bg-bg">
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-line bg-surface/50 lg:flex">
      <RouterLink to="/admin" class="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <span class="grid h-8 w-8 place-items-center rounded-[8px] border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary">
          ZF
        </span>
        <span class="leading-tight">
          <span class="block text-[13.5px] font-medium">内容后台</span>
          <span class="eyebrow text-[8.5px]">CONTENT OPS</span>
        </span>
      </RouterLink>

      <nav class="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="后台导航">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors"
          :class="isActive(item) ? 'bg-surface2 text-ink' : 'text-dim hover:bg-surface hover:text-ink'"
        >
          <component :is="item.icon" :size="16" :class="isActive(item) ? 'text-primary' : ''" />
          {{ item.label }}
          <span v-if="item.name === 'admin-dashboard' && pending" class="num ml-auto rounded bg-primary/10 px-1.5 text-[9px] text-primary">
            {{ pending }}
          </span>
        </RouterLink>
      </nav>

      <div class="space-y-2 border-t border-line p-3">
        <RouterLink
          to="/admin/connect"
          class="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-[11px] text-dim hover:text-ink"
        >
          <span class="inline-flex items-center gap-1.5">
            <Database :size="12" />
            {{ dbMode === 'turso' ? 'Turso 云端' : '本地 IndexedDB' }}
          </span>
          <span class="h-1.5 w-1.5 rounded-full" :class="dbMode === 'turso' ? 'bg-success' : 'bg-warn'" />
        </RouterLink>
        <RouterLink to="/" class="flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px] text-dim hover:text-ink">
          查看前台 <ArrowUpRight :size="12" />
        </RouterLink>
        <button type="button" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11.5px] text-dim hover:text-danger" @click="doLogout">
          退出登录 <LogOut :size="12" />
        </button>
      </div>
    </aside>

    <div class="lg:pl-[228px]">
      <header class="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
        <div class="flex items-center gap-2.5">
          <RouterLink to="/admin" class="grid h-7 w-7 place-items-center rounded-[7px] border border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary lg:hidden">
            ZF
          </RouterLink>
          <h1 class="text-[14px] font-medium">{{ title }}</h1>
          <button
            v-if="pending"
            type="button"
            class="chip !h-[22px] !text-[10px]"
            title="有改动未发布"
            @click="openPublish"
          >
            {{ pending }} 项待发布
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="btn btn-sm btn-primary !h-8 !min-h-0 !px-2.5 !text-[11.5px]" @click="openPublish">
            <Rocket :size="13" /> <span class="hidden xs:inline">发布</span>
          </button>
          <RouterLink
            :to="dbMode === 'turso' ? '/admin/connect' : '/admin/data'"
            class="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10.5px] text-dim hover:text-ink xs:flex"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="dbMode === 'turso' ? 'bg-success' : 'bg-warn'" />
            {{ dbMode === 'turso' ? '云端' : '本地' }}
          </RouterLink>
          <RouterLink to="/" class="icon-btn !h-9 !w-9" aria-label="查看前台" target="_blank">
            <ArrowUpRight :size="16" />
          </RouterLink>
          <button type="button" class="icon-btn !h-9 !w-9" aria-label="退出登录" @click="doLogout">
            <LogOut :size="16" />
          </button>
        </div>
      </header>

      <div
        v-if="pending"
        class="flex flex-wrap items-center justify-between gap-2 border-b border-warn/25 bg-warn/10 px-4 py-1.5 text-[11px] text-warn md:px-6"
      >
        <span>有 {{ pending }} 项改动未发布，线上仍是旧快照。</span>
        <button type="button" class="inline-flex items-center gap-1 font-medium text-warn underline-offset-2 hover:underline" @click="openPublish">
          立即发布 <Rocket :size="11" />
        </button>
      </div>

      <main class="mx-auto w-full max-w-[1200px] px-4 py-6 pb-28 md:px-6 lg:pb-12">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page-fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg/95 backdrop-blur safe-bottom lg:hidden"
      aria-label="后台底部导航"
    >
      <RouterLink
        v-for="item in mobileNav"
        :key="item.to"
        :to="item.to"
        class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors"
        :class="isActive(item) ? 'text-primary' : 'text-dim'"
      >
        <component :is="item.icon" :size="18" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <PublishDialog :open="publishOpen" @close="publishOpen = false" @published="publishOpen = false" />
  </div>
</template>
