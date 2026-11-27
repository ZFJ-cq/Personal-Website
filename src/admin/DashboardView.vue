<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowUpRight,
  BarChart3,
  Database,
  FileDown,
  FolderKanban,
  HardDriveDownload,
  Plus,
  Rocket,
  Smartphone,
} from 'lucide-vue-next'
import { listWorks, getSiteStats, type SiteStats } from '@/api/works'
import { dbMode } from '@/db'
import { STATUS_LABEL, type WorkStatus, type WorkWithTags } from '@/db/types'
import { useSiteStore } from '@/stores/site'
import { publishedRevision } from '@/composables/usePublish'
import { formatDate } from '@/lib/utils'

const site = useSiteStore()

const works = ref<WorkWithTags[]>([])
const stats = ref<SiteStats>({ works: 0, apps: 0, bugs: 0, cases: 0 })
const loading = ref(true)

const revision = computed(() => site.settings.contentRevision || 0)
const pending = computed(() => Math.max(0, revision.value - publishedRevision.value))

const statusCount = computed(() => {
  const map: Record<WorkStatus, number> = { draft: 0, wip: 0, done: 0, archived: 0 }
  for (const work of works.value) map[work.status] += 1
  return map
})

const recent = computed(() => works.value.slice(0, 6))
const lastExport = ref('')

const backupDue = computed(() => {
  if (!lastExport.value) return true
  const diff = Date.now() - new Date(lastExport.value).getTime()
  return diff > 30 * 24 * 60 * 60 * 1000
})

const cards = computed(() => [
  { label: '公开作品', value: stats.value.works, sub: 'WORKS', icon: FolderKanban, to: '/admin/works' },
  { label: '被测 App', value: stats.value.apps, sub: 'APPS', icon: Smartphone, to: '/admin/apps' },
  { label: '累计缺陷', value: stats.value.bugs, sub: 'BUGS', icon: BarChart3, to: '/admin/analytics' },
  { label: '用例总数', value: stats.value.cases, sub: 'CASES', icon: Database, to: '/admin/analytics' },
])

async function load() {
  loading.value = true
  try {
    const [all, siteStats] = await Promise.all([
      listWorks({ kind: 'work', includeAll: true, limit: 200 }),
      getSiteStats(),
    ])
    const apps = await listWorks({ kind: 'app', includeAll: true, limit: 200 })
    works.value = [...all, ...apps].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    stats.value = siteStats
    await site.load(true)
  } finally {
    loading.value = false
  }
}

function openPublish() {
  window.dispatchEvent(new Event('zf:publish'))
}

onMounted(() => {
  document.title = '概览 · 内容后台'
  lastExport.value = localStorage.getItem('zf.lastExport') || ''
  load()
})
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">DASHBOARD</p>
        <h1 class="mt-2 text-[22px] font-semibold">你好，{{ site.profile.name }}</h1>
        <p class="mt-1 text-[12.5px] text-dim">
          今天 {{ formatDate(new Date().toISOString()) }}。改动会实时写入当前数据源，前台刷新即可见。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/admin/works/new" class="btn btn-primary btn-sm"><Plus :size="14" /> 新建作品</RouterLink>
        <RouterLink to="/admin/apps/new" class="btn btn-sm"><Plus :size="14" /> 新建 App</RouterLink>
      </div>
    </header>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <RouterLink
        v-for="card in cards"
        :key="card.sub"
        :to="card.to"
        class="card card-hover p-4 md:p-5"
      >
        <div class="flex items-start justify-between">
          <component :is="card.icon" :size="16" class="text-dim" />
          <span class="eyebrow text-[8.5px]">{{ card.sub }}</span>
        </div>
        <p class="num mt-4 text-[28px] leading-none">{{ card.value }}</p>
        <p class="mt-1.5 text-[12px] text-dim">{{ card.label }}</p>
      </RouterLink>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 class="text-[13.5px] font-medium">最近更新</h2>
          <RouterLink to="/admin/works" class="text-[11.5px] text-dim hover:text-primary">全部作品</RouterLink>
        </div>
        <div v-if="loading" class="space-y-3 p-5">
          <div v-for="i in 4" :key="i" class="skeleton h-10" />
        </div>
        <ul v-else class="divide-y divide-line/70">
          <li v-for="item in recent" :key="item.id">
            <div class="flex items-center gap-3 px-4 py-3 md:px-5">
              <span class="chip !h-[22px] shrink-0 !text-[10px]">{{ item.kind === 'app' ? 'APP' : 'WORK' }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[12.5px]">{{ item.title }}</p>
                <p class="num truncate text-[10.5px] text-dim">{{ item.slug }}</p>
              </div>
              <span class="badge shrink-0" :class="`badge-${item.status}`">{{ STATUS_LABEL[item.status] }}</span>
              <span class="num hidden shrink-0 text-[10.5px] text-dim md:block">{{ formatDate(item.updated_at, 'MM-DD HH:mm') }}</span>
              <RouterLink
                :to="`/admin/${item.kind === 'app' ? 'apps' : 'works'}/${item.id}/edit`"
                class="icon-btn !h-8 !w-8 shrink-0"
                :aria-label="`编辑 ${item.title}`"
              >
                <ArrowUpRight :size="14" />
              </RouterLink>
            </div>
          </li>
          <li v-if="!recent.length" class="px-5 py-10 text-center text-[12.5px] text-dim">
            还没有内容。先新建一条作品吧。
          </li>
        </ul>
      </section>

      <div class="space-y-4">
        <section class="card p-4 md:p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-[13.5px] font-medium">发布状态</h2>
            <span class="badge" :class="pending ? 'badge-wip' : 'badge-done'">{{ pending ? '有改动' : '已同步' }}</span>
          </div>
          <p class="mt-3 text-[12px] leading-relaxed text-dim">
            <template v-if="pending">有 {{ pending }} 项内容改动待发布。静态站需要重新构建，线上快照才会更新。</template>
            <template v-else>当前内容与上次发布记录一致，也可以重新发布当前版本。</template>
          </p>
          <p class="num mt-2 text-[10.5px] text-dim">
            LAST PUBLISH {{ site.settings.lastPublishedAt || '—' }}
          </p>
          <button type="button" class="btn btn-sm btn-primary mt-4 w-full" @click="openPublish">
            <Rocket :size="13" /> 发布到前台
          </button>
        </section>

        <section class="card p-4 md:p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-[13.5px] font-medium">状态分布</h2>
            <span class="eyebrow text-[8.5px]">TOTAL {{ works.length }}</span>
          </div>
          <div class="mt-3 space-y-2.5">
            <div v-for="(count, status) in statusCount" :key="status" class="flex items-center gap-2">
              <span class="w-12 shrink-0 text-[11px] text-dim">{{ STATUS_LABEL[status] }}</span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                <div
                  class="h-full rounded-full"
                  :class="status === 'done' ? 'bg-success' : status === 'wip' ? 'bg-warn' : status === 'draft' ? 'bg-primary' : 'bg-dim'"
                  :style="{ width: `${works.length ? (count / works.length) * 100 : 0}%` }"
                />
              </div>
              <span class="num w-6 text-right text-[11px]">{{ count }}</span>
            </div>
          </div>
        </section>

        <section class="card p-4 md:p-5">
          <h2 class="text-[13.5px] font-medium">快捷操作</h2>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <RouterLink to="/admin/data" class="btn btn-sm justify-start"><HardDriveDownload :size="14" /> 导出数据</RouterLink>
            <RouterLink to="/admin/analytics" class="btn btn-sm justify-start"><BarChart3 :size="14" /> 访客统计</RouterLink>
            <RouterLink to="/admin/settings" class="btn btn-sm justify-start"><FileDown :size="14" /> 站点设置</RouterLink>
            <RouterLink to="/admin/connect" class="btn btn-sm justify-start"><Database :size="14" /> 数据源</RouterLink>
          </div>
        </section>

        <section v-if="backupDue" class="rounded-[12px] border border-warn/35 bg-warn/10 p-4">
          <p class="text-[12px] font-medium text-warn">该导出一次备份了</p>
          <p class="mt-1 text-[11.5px] leading-relaxed text-dim">距上次导出超过 30 天。导出的 .db 可随时恢复，建议每月一次。</p>
          <RouterLink to="/admin/data" class="btn btn-sm mt-3">去导出</RouterLink>
        </section>

        <section class="card p-4 md:p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-[13.5px] font-medium">数据源</h2>
            <span class="h-1.5 w-1.5 rounded-full" :class="dbMode === 'turso' ? 'bg-success' : 'bg-warn'" />
          </div>
          <p class="mt-2 text-[12px] text-dim">{{ dbMode === 'turso' ? 'Turso 云端 SQLite' : '本地 IndexedDB（sql.js）' }}</p>
          <p class="mt-1 text-[11px] leading-relaxed text-dim">
            {{ dbMode === 'turso' ? '换设备后重新输入 URL 与 Token 即可继续编辑。' : '数据只保存在当前浏览器；换设备前请导出 .db，或连接 Turso。' }}
          </p>
          <RouterLink to="/admin/connect" class="link-underline mt-3 inline-block text-[11.5px] text-primary">连接设置</RouterLink>
        </section>
      </div>
    </div>

    <p class="num text-center text-[10px] text-dim opacity-70">
      {{ loading ? 'LOADING…' : `ARCHIVE READY · ${works.length} ENTRIES` }}
    </p>
  </div>
</template>
