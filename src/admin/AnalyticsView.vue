<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Activity,
  CircleHelp,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-vue-next'
import {
  generateDemoVisits,
  getBrowsers,
  getCountries,
  getDevices,
  getFunnel,
  getHourlyActivity,
  getOverview,
  getRealtime,
  getRecentEvents,
  getSources,
  getTopContent,
  getTrend,
  purgeOldVisits,
  type EventRow,
  type FunnelStep,
  type HeatmapData,
  type Overview,
  type RealtimeRow,
  type Slice,
  type TopContentRow,
  type TrendPoint,
} from '@/analytics/report'
import { getAnalyticsSettings } from '@/api/settings'
import { formatNumber } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import LineChart from '@/components/charts/LineChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarList from '@/components/charts/BarList.vue'
import FunnelChart from '@/components/charts/FunnelChart.vue'
import Heatmap from '@/components/charts/Heatmap.vue'

const { toast } = useToast()

const range = ref(7)
const loading = ref(true)
const polling = ref(true)
const busy = ref(false)
const lastUpdated = ref('')
const online = ref(0)
const realtime = ref<RealtimeRow[]>([])
const events = ref<EventRow[]>([])
const overview = ref<Overview>({ todayPv: 0, todayUv: 0, weekPv: 0, monthUv: 0, sessions: 0, bounceRate: 0 })
const trend = ref<TrendPoint[]>([])
const topContent = ref<TopContentRow[]>([])
const sources = ref<{ groups: Slice[]; domains: Array<{ host: string; pv: number }> }>({ groups: [], domains: [] })
const devices = ref<Slice[]>([])
const browsers = ref<Slice[]>([])
const countries = ref<Slice[]>([])
const funnel = ref<FunnelStep[]>([])
const heatmap = ref<HeatmapData>({ matrix: [], max: 0, total: 0 })

let timer: ReturnType<typeof setInterval> | null = null

const countryLabel: Record<string, string> = {
  CN: '中国',
  US: '美国',
  SG: '新加坡',
  JP: '日本',
  HK: '中国香港',
  TW: '中国台湾',
  GB: '英国',
  DE: '德国',
  CA: '加拿大',
  AU: '澳大利亚',
}

const trendLabels = computed(() => trend.value.map((point) => point.date.slice(5)))
const trendSeries = computed(() => [
  { name: 'PV', color: 'var(--primary)', values: trend.value.map((p) => p.pv) },
  { name: 'UV', color: 'var(--primary-soft)', values: trend.value.map((p) => p.uv), dash: true },
])

const totalPv = computed(() => trend.value.reduce((sum, p) => sum + p.pv, 0))

const cards = computed(() => [
  { label: '今日 PV', value: formatNumber(overview.value.todayPv), sub: '浏览量', tip: '今日 pageview 事件数，同会话刷新计入。' },
  { label: '今日 UV', value: formatNumber(overview.value.todayUv), sub: '访客数', tip: '同一日内按 visitor_id 去重，仅日 UV。' },
  { label: '7 日 PV', value: formatNumber(overview.value.weekPv), sub: '近 7 天', tip: '最近 7 个自然日 pageview 总量。' },
  { label: '30 日 UV', value: formatNumber(overview.value.monthUv), sub: '近 30 天', tip: '最近 30 天按 visitor_id 去重；跨月不可关联。' },
  { label: '会话数', value: formatNumber(overview.value.sessions), sub: '近 7 天', tip: '30 分钟静默切新会话，按 session_id 去重。' },
  { label: '跳出率', value: `${overview.value.bounceRate}%`, sub: '单页会话', tip: '只产生 1 次 pageview 的会话占比；单页站偏高属正常。' },
])

const deviceRows = computed(() => devices.value.map((slice) => ({ ...slice })))
const browserRows = computed(() => browsers.value.map((slice) => ({ ...slice })))
const countryRows = computed(() =>
  countries.value.map((slice) => ({ ...slice, label: countryLabel[slice.label] ?? slice.label ?? '未知' })),
)
const domainRows = computed(() => {
  const total = sources.value.domains.reduce((sum, d) => sum + d.pv, 0)
  return sources.value.domains.map((d) => ({ label: d.host, value: d.pv, pct: total ? Math.round((d.pv / total) * 100) : 0 }))
})

const eventLabel: Record<string, string> = {
  outbound: '外链点击',
  resume: '简历下载',
  search: '站内搜索',
  pageview: '浏览',
}

function eventMeta(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function eventDetail(row: EventRow): string {
  const meta = eventMeta(row.meta)
  if (row.event === 'outbound') return `${meta.slug ?? ''} → ${meta.url_host ?? '外链'}`
  if (row.event === 'resume') return '简历按钮'
  if (row.event === 'search') return `关键词哈希 ${String(meta.keyword_hash ?? '').slice(0, 8)}… · ${meta.results ?? 0} 条结果`
  return row.path
}

function timeOf(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function pathLink(path: string): string | null {
  if (path.startsWith('/works/') || path.startsWith('/apps/')) return path
  return null
}

async function refreshRealtime() {
  try {
    const [live, recent] = await Promise.all([getRealtime(), getRecentEvents(10)])
    online.value = live.online
    realtime.value = live.rows
    events.value = recent
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    // 轮询失败静默处理，保留上次数据
  }
}

async function refreshRange() {
  const days = range.value
  try {
    const [trendData, top, sourceData, deviceData, browserData, countryData, funnelData, heatData] =
      await Promise.all([
        getTrend(days),
        getTopContent(days, 10),
        getSources(days),
        getDevices(days),
        getBrowsers(days),
        getCountries(days),
        getFunnel(days),
        getHourlyActivity(days),
      ])
    trend.value = trendData
    topContent.value = top
    sources.value = sourceData
    devices.value = deviceData
    browsers.value = browserData
    countries.value = countryData
    funnel.value = funnelData
    heatmap.value = heatData
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

async function refreshOverview() {
  try {
    overview.value = await getOverview()
  } catch {
    /* 概览失败时保留旧值 */
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([refreshOverview(), refreshRange(), refreshRealtime()])
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (busy.value) return
  busy.value = true
  try {
    const count = await generateDemoVisits(30)
    toast(`已生成 ${count} 条演示访问记录`)
    await refreshAll()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = false
  }
}

function togglePolling() {
  polling.value = !polling.value
  if (polling.value) void refreshRealtime()
}

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (!polling.value) return
    if (document.visibilityState !== 'visible') return
    void refreshRealtime()
  }, 30000)
}

function onVisible() {
  if (document.visibilityState === 'visible' && polling.value) void refreshRealtime()
}

watch(range, () => {
  void refreshRange()
})

onMounted(async () => {
  document.title = '访客统计 · 内容后台'
  try {
    const settings = await getAnalyticsSettings()
    const removed = await purgeOldVisits(settings.retentionDays || 180)
    if (removed) toast(`已自动清理 ${removed} 条超过保留期的访问记录`, 'info')
  } catch {
    /* 清理失败不阻断看板 */
  }
  await refreshAll()
  startTimer()
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">INSIGHT / ANALYTICS</p>
        <h1 class="mt-2 text-[22px] font-semibold">访客统计</h1>
        <p class="mt-1 flex items-center gap-1.5 text-[12.5px] text-dim">
          <Users :size="13" /> 匿名聚合 · 不记录 IP 与 Cookie
          <span class="num ml-2">LAST {{ lastUpdated || '—' }}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="!totalPv" type="button" class="btn btn-sm" :disabled="busy" @click="generate">
          <Sparkles :size="14" /> {{ busy ? '生成中…' : '生成演示数据' }}
        </button>
        <RouterLink to="/admin/settings" class="btn btn-sm">统计设置</RouterLink>
        <button type="button" class="btn btn-sm" :disabled="loading" @click="refreshAll">
          <RefreshCw :size="14" :class="loading ? 'animate-spin' : ''" /> 刷新
        </button>
      </div>
    </header>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div v-for="card in cards" :key="card.label" class="card p-4" :title="card.tip">
        <div class="flex items-center gap-1">
          <span class="eyebrow text-[9.5px]">{{ card.label }}</span>
          <CircleHelp :size="10" class="text-dim/60" />
        </div>
        <p class="num mt-3 text-[24px] leading-none">{{ card.value }}</p>
        <p class="mt-1.5 text-[10.5px] text-dim">{{ card.sub }}</p>
      </div>
    </div>

    <section class="card p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h2 class="text-[13.5px] font-medium">访问趋势</h2>
          <span class="eyebrow text-[9px]">PV / UV</span>
        </div>
        <div class="segmented">
          <button v-for="days in [7, 14, 30]" :key="days" type="button" :class="{ 'is-active': range === days }" @click="range = days">
            {{ days }} 天
          </button>
        </div>
      </div>
      <div v-if="loading" class="skeleton mt-4 h-[240px]" />
      <div v-else-if="!totalPv" class="grid place-items-center py-14 text-center">
        <p class="text-[13px] font-medium">暂无访问数据</p>
        <p class="mt-1 max-w-[36ch] text-[11.5px] leading-relaxed text-dim">
          打开前台转一圈，或生成一份演示数据先看看看板长什么样。
        </p>
        <button type="button" class="btn btn-sm mt-4" :disabled="busy" @click="generate">
          <Sparkles :size="13" /> 生成演示数据
        </button>
      </div>
      <div v-else class="mt-2">
        <LineChart :series="trendSeries" :labels="trendLabels" :height="230" />
      </div>
    </section>

    <section class="card p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-[13.5px] font-medium">活跃时段</h2>
          <span class="eyebrow text-[9px]">周 × 小时</span>
        </div>
        <span class="eyebrow text-[8.5px]">{{ range }}D · LOCAL TIME</span>
      </div>
      <div v-if="loading" class="skeleton mt-4 h-[150px]" />
      <div v-else-if="!heatmap.total" class="py-10 text-center text-[11.5px] text-dim">暂无访问数据。</div>
      <Heatmap v-else :data="heatmap" class="mt-4" />
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="card p-4 md:p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-[13.5px] font-medium">Top 内容</h2>
          <span class="eyebrow text-[8.5px]">BY PV · {{ range }}D</span>
        </div>
        <div v-if="!topContent.length" class="py-10 text-center text-[11.5px] text-dim">还没有内容访问记录。</div>
        <ul v-else class="mt-3 space-y-0">
          <li v-for="(row, index) in topContent" :key="row.slug" class="border-b border-line/60 py-2.5 last:border-0">
            <div class="flex items-center gap-2.5">
              <span class="num w-5 shrink-0 text-[10px] text-dim">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="min-w-0 flex-1">
                <RouterLink
                  v-if="row.online"
                  :to="`/${row.kind === 'app' ? 'apps' : 'works'}/${row.slug}`"
                  target="_blank"
                  class="block truncate text-[12.5px] transition-colors hover:text-primary"
                >
                  {{ row.title }}
                </RouterLink>
                <span v-else class="block truncate text-[12.5px] text-dim">{{ row.title }}</span>
                <p class="num mt-0.5 text-[10px] text-dim">
                  PV {{ row.pv }} · UV {{ row.uv }} · 外链 {{ row.outbound }}
                  <span v-if="!row.online" class="ml-1 text-warn">已下线</span>
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section class="card p-4 md:p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-[13.5px] font-medium">来源分析</h2>
          <span class="eyebrow text-[8.5px]">{{ range }}D</span>
        </div>
        <div class="mt-4">
          <BarList :rows="sources.groups" color="var(--primary)" />
        </div>
        <div v-if="domainRows.length" class="mt-4 border-t border-line/70 pt-4">
          <p class="eyebrow mb-2">TOP DOMAINS</p>
          <BarList :rows="domainRows" color="var(--text-dim)" />
        </div>
      </section>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <section class="card p-4 md:p-5">
        <h2 class="text-[13.5px] font-medium">设备占比</h2>
        <div class="mt-4">
          <DonutChart :slices="deviceRows" unit="PV" />
        </div>
      </section>
      <section class="card p-4 md:p-5">
        <h2 class="text-[13.5px] font-medium">浏览器</h2>
        <div class="mt-4">
          <DonutChart :slices="browserRows" unit="PV" />
        </div>
      </section>
      <section class="card p-4 md:p-5">
        <h2 class="text-[13.5px] font-medium">地域 Top 8</h2>
        <div class="mt-4">
          <BarList :rows="countryRows" color="var(--success)" />
        </div>
      </section>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="card p-4 md:p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-[13.5px] font-medium">转化漏斗</h2>
          <span class="eyebrow text-[8.5px]">{{ range }}D</span>
        </div>
        <p class="mt-1 text-[10.5px] text-dim">首页 → 详情页 → 外链点击 → 简历下载；比率为相对上一步。</p>
        <div class="mt-4">
          <FunnelChart :steps="funnel" />
        </div>
      </section>

      <section class="card p-4 md:p-5">
        <h2 class="text-[13.5px] font-medium">事件明细</h2>
        <div v-if="!events.length" class="py-10 text-center text-[11.5px] text-dim">还没有外链、简历或搜索事件。</div>
        <ul v-else class="mt-3 space-y-0">
          <li v-for="(row, index) in events" :key="index" class="flex items-start justify-between gap-3 border-b border-line/60 py-2.5 last:border-0">
            <div class="min-w-0">
              <p class="text-[12px]">
                <span class="chip !h-[20px] !text-[9px]">{{ eventLabel[row.event] ?? row.event }}</span>
                <span class="ml-1.5 break-anywhere text-dim">{{ eventDetail(row) }}</span>
              </p>
              <p class="num mt-0.5 text-[10px] text-dim">{{ row.path }}</p>
            </div>
            <span class="num shrink-0 text-[10px] text-dim">{{ timeOf(row.ts) }}</span>
          </li>
        </ul>
      </section>
    </div>

    <section class="card p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <Activity :size="15" class="text-success" />
          <h2 class="text-[13.5px] font-medium">实时</h2>
          <span class="num rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] text-success">{{ online }} 在线</span>
          <span class="text-[10.5px] text-dim">过去 5 分钟</span>
        </div>
        <button type="button" class="btn btn-sm" @click="togglePolling">
          <Pause v-if="polling" :size="12" />
          <Play v-else :size="12" />
          {{ polling ? '暂停 30s 刷新' : '恢复刷新' }}
        </button>
      </div>
      <div v-if="!realtime.length" class="py-8 text-center text-[11.5px] text-dim">当前没有在线访问。</div>
      <ul v-else class="mt-3 divide-y divide-line/60">
        <li v-for="(row, index) in realtime" :key="index" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[11px]">
          <span class="num shrink-0 text-dim">{{ timeOf(row.ts) }}</span>
          <RouterLink v-if="pathLink(row.path)" :to="pathLink(row.path) || '/'" target="_blank" class="break-anywhere text-primary hover:underline">
            {{ row.path }}
          </RouterLink>
          <span v-else class="break-anywhere">{{ row.path }}</span>
          <span class="text-dim">{{ row.ref_host || '直接访问' }}</span>
          <span class="ml-auto flex shrink-0 items-center gap-2 text-dim">
            <span>{{ row.device || '未知' }}</span>
            <span>{{ row.browser || '未知' }}</span>
            <span v-if="row.country">{{ countryLabel[row.country] ?? row.country }}</span>
          </span>
        </li>
      </ul>
      <p class="mt-2 text-[10px] text-dim">
        指标口径：PV 为 pageview 事件数；UV 为同一日 visitor_id 去重；会话按 30 分钟静默切分。
      </p>
    </section>
  </div>
</template>
