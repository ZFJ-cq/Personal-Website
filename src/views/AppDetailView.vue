<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CalendarRange, Copy, ExternalLink, Layers, MonitorSmartphone, Rocket, ShieldCheck } from 'lucide-vue-next'
import { getRelatedWorks, getSlugRedirect, getWorkDetail } from '@/api/works'
import { CONCLUSION_LABEL, PROFILE_FALLBACK, parseAppMeta, type WorkDetail, type WorkWithTags } from '@/db/types'
import { useSiteStore } from '@/stores/site'
import { applySeo, setJsonLd } from '@/lib/seo'
import { copyText, formatDate, formatNumber, monthRange } from '@/lib/utils'
import { trackOutbound } from '@/analytics/collect'
import { useToast } from '@/composables/useToast'
import PageContainer from '@/components/PageContainer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ImageWithFallback from '@/components/ImageWithFallback.vue'
import AppCard from '@/components/AppCard.vue'

const route = useRoute()
const router = useRouter()
const site = useSiteStore()
const { toast } = useToast()
const authorName = computed(() => site.profile.name || PROFILE_FALLBACK.name)

const detail = ref<WorkDetail | null>(null)
const related = ref<WorkWithTags[]>([])
const loading = ref(true)
const error = ref('')

const meta = computed(() => parseAppMeta(detail.value?.meta ?? null))
const level = computed(() => meta.value.conclusion_level ?? 'pass')
const period = computed(() => meta.value.test_cycle || monthRange(detail.value?.started_at, detail.value?.finished_at))
const letter = computed(() => detail.value?.title.slice(0, 1) ?? '·')
const p0Pct = computed(() => (meta.value.bug_total ? Math.round((meta.value.bug_p0 / meta.value.bug_total) * 100) : 0))
const openPct = computed(() =>
  meta.value.bug_total ? Math.round((meta.value.bug_open / meta.value.bug_total) * 100) : 0,
)

function plainText(markdown: string | null): string {
  if (!markdown) return ''
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function load(slug: string) {
  loading.value = true
  error.value = ''
  detail.value = null
  related.value = []
  try {
    const found = await getWorkDetail(slug)
    if (!found || (found.status !== 'done' && found.status !== 'wip')) {
      const next = await getSlugRedirect(slug)
      if (next) {
        await router.replace(`/apps/${next}`)
        return
      }
      await router.replace('/404')
      return
    }
    detail.value = found
    const description = plainText(found.subtitle || found.summary).slice(0, 150)
    applySeo({
      title: `${found.title} · 测试履历`,
      description: description || `${found.title} — 测试履历`,
      image: found.cover_url || undefined,
      type: 'article',
    })
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: found.title,
      applicationCategory: 'MobileApplication',
      operatingSystem: meta.value.platforms.join(', ') || undefined,
      softwareVersion: meta.value.version || undefined,
      description,
      author: { '@type': 'Person', name: authorName.value },
    })
    related.value = (await getRelatedWorks(found, 3).catch(() => [])).filter((w) => w.kind === 'app')
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function copyLink() {
  try {
    await copyText(window.location.href)
    toast('已复制链接')
  } catch {
    toast('复制失败，请手动复制地址栏链接', 'error')
  }
}

function onOutbound(slug: string, url: string) {
  void trackOutbound(slug, url)
}

watch(
  () => route.params.slug,
  (slug) => {
    if (typeof slug === 'string') load(slug)
  },
  { immediate: true },
)

onBeforeUnmount(() => setJsonLd(null))
</script>

<template>
  <PageContainer>
    <div v-if="loading" class="py-16">
      <div class="skeleton h-4 w-40" />
      <div class="mt-8 flex gap-4">
        <div class="skeleton h-20 w-20" />
        <div class="flex-1 space-y-3">
          <div class="skeleton h-8 w-2/3" />
          <div class="skeleton h-4 w-1/2" />
        </div>
      </div>
      <div class="skeleton mt-10 h-40 w-full" />
    </div>

    <div v-else-if="error" class="card my-16 p-8 text-center">
      <p class="text-[15px] font-medium">履历加载失败</p>
      <p class="mt-2 text-[13px] text-dim">{{ error }}</p>
      <button type="button" class="btn mt-6" @click="load(String(route.params.slug))">重试</button>
    </div>

    <template v-else-if="detail">
      <nav class="no-print flex flex-wrap items-center gap-2 py-6 text-[12px] text-dim" aria-label="面包屑">
        <RouterLink to="/" class="hover:text-ink">首页</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink to="/apps" class="hover:text-ink">测试过的 App</RouterLink>
        <span aria-hidden="true">/</span>
        <span class="max-w-[26ch] truncate text-ink">{{ detail.title }}</span>
      </nav>

      <RouterLink to="/apps" class="no-print inline-flex items-center gap-1.5 text-[12.5px] text-dim hover:text-primary">
        <ArrowLeft :size="14" /> 返回测试履历
      </RouterLink>

      <header class="mt-6 flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        <div class="app-icon relative h-20 w-20 shrink-0 overflow-hidden rounded-[16px] border border-line bg-surface2">
          <ImageWithFallback :src="detail.cover_url" :alt="`${detail.title} 图标`" :letter="letter" eager />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge" :class="`badge-${level}`">{{ CONCLUSION_LABEL[level] }}</span>
            <span v-if="meta.version" class="eyebrow">V{{ meta.version }}</span>
            <span v-if="meta.platforms.length" class="eyebrow">{{ meta.platforms.join(' / ') }}</span>
          </div>
          <h1 class="display-lg mt-3 max-w-[26ch]">{{ detail.title }}</h1>
          <p v-if="detail.subtitle" class="mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-dim md:text-[16px]">
            {{ detail.subtitle }}
          </p>
        </div>
        <button type="button" class="btn no-print shrink-0 !min-h-[38px] btn-sm" @click="copyLink">
          <Copy :size="14" /> 复制链接
        </button>
      </header>

      <div class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="card p-4 md:p-5">
          <p class="num text-[clamp(24px,3.4vw,32px)] leading-none">{{ formatNumber(meta.case_count) }}</p>
          <p class="mt-2 text-[12px] text-dim">执行用例</p>
        </div>
        <div class="card p-4 md:p-5">
          <p class="num text-[clamp(24px,3.4vw,32px)] leading-none">{{ formatNumber(meta.bug_total) }}</p>
          <p class="mt-2 text-[12px] text-dim">发现缺陷</p>
        </div>
        <div class="card p-4 md:p-5">
          <p class="num text-[clamp(24px,3.4vw,32px)] leading-none text-danger">{{ formatNumber(meta.bug_p0) }}</p>
          <p class="mt-2 text-[12px] text-dim">其中 P0</p>
        </div>
        <div class="card p-4 md:p-5">
          <p class="num text-[clamp(24px,3.4vw,32px)] leading-none text-warn">{{ formatNumber(meta.bug_open) }}</p>
          <p class="mt-2 text-[12px] text-dim">当前未关闭</p>
        </div>
      </div>

      <div class="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div class="min-w-0">
          <section v-if="meta.bug_total" class="card p-5 md:p-6">
            <div class="flex items-center justify-between gap-3">
              <p class="eyebrow">DEFECT DISTRIBUTION</p>
              <span class="num text-[11px] text-dim">TOTAL {{ meta.bug_total }}</span>
            </div>
            <div class="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface2" role="img" :aria-label="`P0 缺陷占比 ${p0Pct}%`">
              <div class="h-full bg-danger" :style="{ width: `${p0Pct}%` }" />
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-dim">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-danger" /> P0 {{ meta.bug_p0 }}（{{ p0Pct }}%）
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-primary" /> 其他 {{ Math.max(0, meta.bug_total - meta.bug_p0) }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-warn" /> 未关闭 {{ meta.bug_open }}（{{ openPct }}%）
              </span>
            </div>
          </section>

          <section v-if="meta.conclusion" class="mt-4 rounded-[12px] border border-line bg-surface/60 p-5">
            <div class="flex items-center gap-2">
              <ShieldCheck :size="16" :class="level === 'pass' ? 'text-success' : level === 'conditional' ? 'text-warn' : 'text-danger'" />
              <p class="eyebrow">CONCLUSION</p>
            </div>
            <p class="mt-2.5 text-[14px] leading-relaxed">{{ meta.conclusion }}</p>
          </section>

          <div class="mt-8">
            <MarkdownViewer v-if="detail.summary" :source="detail.summary" />
            <p v-else class="text-[13.5px] text-dim">测试报告正文还在整理。</p>
          </div>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-24">
          <div class="card p-5">
            <p class="eyebrow">TEST SHEET</p>
            <dl class="mt-4 space-y-0 text-[12.5px]">
              <div v-if="meta.version" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><Rocket :size="13" /> 版本</dt>
                <dd class="num text-right">{{ meta.version }}</dd>
              </div>
              <div v-if="meta.platforms.length" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><MonitorSmartphone :size="13" /> 平台</dt>
                <dd class="text-right">{{ meta.platforms.join(' / ') }}</dd>
              </div>
              <div v-if="period" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><CalendarRange :size="13" /> 周期</dt>
                <dd class="num text-right">{{ period }}</dd>
              </div>
              <div v-if="meta.test_types.length" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><Layers :size="13" /> 类型</dt>
                <dd class="text-right">{{ meta.test_types.join(' / ') }}</dd>
              </div>
              <div v-if="meta.env" class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-dim">环境</dt>
                <dd class="text-right">{{ meta.env }}</dd>
              </div>
            </dl>

            <div v-if="meta.test_scope" class="mt-4 border-t border-line pt-4">
              <p class="eyebrow">SCOPE</p>
              <p class="mt-2 text-[12.5px] leading-relaxed text-dim">{{ meta.test_scope }}</p>
            </div>

            <div v-if="detail.links.length" class="mt-5 space-y-2 border-t border-line pt-4">
              <a
                v-for="link in detail.links"
                :key="link.id"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="btn w-full justify-between !min-h-[40px] text-[12.5px]"
                @click="onOutbound(detail.slug, link.url)"
              >
                {{ link.label }}
                <ExternalLink :size="14" />
              </a>
            </div>
          </div>

          <p class="px-1 text-[11px] leading-relaxed text-dim">
            数据口径：缺陷数为本轮测试累计提交、去重后数量；P0 指阻塞主流程或资金安全问题。
          </p>
        </aside>
      </div>

      <section v-if="related.length" class="section !pb-0">
        <div class="mb-6 flex items-center gap-3">
          <span class="eyebrow">MORE TEST LOG</span>
          <span class="h-px flex-1 bg-line opacity-60" />
        </div>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AppCard v-for="item in related" :key="item.id" :work="item" />
        </div>
      </section>
    </template>
  </PageContainer>
</template>

<style scoped>
.app-icon :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
}
</style>
