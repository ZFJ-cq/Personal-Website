<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  CalendarRange,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Github,
  Link2,
  ShoppingBag,
  UserRound,
} from 'lucide-vue-next'
import { getRelatedWorks, getSlugRedirect, getWorkDetail } from '@/api/works'
import type { WorkDetail, WorkWithTags } from '@/db/types'
import { LINK_TYPE_LABEL, STATUS_LABEL, parseWorkMeta } from '@/db/types'
import { applySeo, setJsonLd } from '@/lib/seo'
import { copyText, formatDate, monthRange } from '@/lib/utils'
import { extractToc, type TocItem } from '@/lib/markdown'
import { trackOutbound } from '@/analytics/collect'
import { useToast } from '@/composables/useToast'
import PageContainer from '@/components/PageContainer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ImageWithFallback from '@/components/ImageWithFallback.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TagPill from '@/components/TagPill.vue'
import WorkCard from '@/components/WorkCard.vue'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const detail = ref<WorkDetail | null>(null)
const related = ref<WorkWithTags[]>([])
const loading = ref(true)
const error = ref('')
const progress = ref(0)
const activeHeading = ref('')

const meta = computed(() => parseWorkMeta(detail.value?.meta ?? null))
const toc = computed<TocItem[]>(() => {
  const items = extractToc(detail.value?.summary ?? '')
  return items.length >= 3 ? items : []
})
const period = computed(() => monthRange(detail.value?.started_at, detail.value?.finished_at))
const letter = computed(() => detail.value?.title.slice(0, 1) ?? '·')

const linkIcon = {
  demo: ExternalLink,
  repo: Github,
  download: Download,
  store: ShoppingBag,
  doc: FileText,
  other: Link2,
}

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
        await router.replace(`/works/${next}`)
        return
      }
      await router.replace('/404')
      return
    }
    detail.value = found

    const tagNames = found.tags.map((t) => t.name).join('、')
    const description = plainText(found.subtitle || found.summary).slice(0, 150)
    applySeo({
      title: `${found.title} · 张福建`,
      description: description || `${found.title} — 作品档案`,
      image: found.cover_url || undefined,
      type: 'article',
    })
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: found.title,
      description,
      image: found.cover_url || undefined,
      keywords: tagNames,
      author: { '@type': 'Person', name: '张福建' },
      datePublished: found.started_at || undefined,
      dateModified: found.updated_at,
    })

    related.value = await getRelatedWorks(found, 3).catch(() => [])
    progress.value = 0
    await nextTick()
    observeHeadings()
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

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

let rafId = 0
let headingObserver: IntersectionObserver | null = null

function updateProgress() {
  const el = document.querySelector<HTMLElement>('[data-article]')
  if (!el) return
  const start = el.offsetTop - 140
  const height = el.offsetHeight - window.innerHeight + 140
  const ratio = height > 0 ? (window.scrollY - start) / height : 0
  progress.value = Math.min(1, Math.max(0, ratio))
}

function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateProgress()
  })
}

/** 用 IntersectionObserver 跟踪当前标题，避免滚动时逐条读取布局 */
function observeHeadings() {
  headingObserver?.disconnect()
  const root = document.querySelector('[data-article]')
  if (!root) return
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]'))
  if (!headings.length) return
  headingObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) activeHeading.value = visible[0].target.id
    },
    { rootMargin: '-120px 0px -65% 0px', threshold: 0 },
  )
  for (const heading of headings) headingObserver.observe(heading)
}

watch(
  () => route.params.slug,
  (slug) => {
    if (typeof slug === 'string') load(slug)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (rafId) cancelAnimationFrame(rafId)
  headingObserver?.disconnect()
  setJsonLd(null)
})
</script>

<template>
  <div
    v-if="toc.length"
    class="fixed left-0 top-0 z-[95] h-[2px] bg-primary transition-[width] duration-150"
    :style="{ width: `${progress * 100}%` }"
    aria-hidden="true"
  />

  <PageContainer>
    <div v-if="loading" class="py-16">
      <div class="skeleton h-4 w-40" />
      <div class="skeleton mt-6 h-10 w-3/4" />
      <div class="skeleton mt-3 h-4 w-1/2" />
      <div class="skeleton mt-8 aspect-[16/10] w-full" />
    </div>

    <div v-else-if="error" class="card my-16 p-8 text-center">
      <p class="text-[15px] font-medium">作品加载失败</p>
      <p class="mt-2 text-[13px] text-dim">{{ error }}</p>
      <button type="button" class="btn mt-6" @click="load(String(route.params.slug))">重试</button>
    </div>

    <template v-else-if="detail">
      <nav class="no-print flex flex-wrap items-center gap-2 py-6 text-[12px] text-dim" aria-label="面包屑">
        <RouterLink to="/" class="hover:text-ink">首页</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink to="/works" class="hover:text-ink">作品集</RouterLink>
        <span aria-hidden="true">/</span>
        <span class="max-w-[26ch] truncate text-ink">{{ detail.title }}</span>
      </nav>

      <div class="flex items-center gap-3">
        <RouterLink to="/works" class="no-print inline-flex items-center gap-1.5 text-[12.5px] text-dim hover:text-primary">
          <ArrowLeft :size="14" /> 返回作品集
        </RouterLink>
        <span class="h-px flex-1 bg-line opacity-60" />
        <span class="eyebrow">{{ detail.category || 'PROJECT' }}</span>
      </div>

      <header class="mt-6">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :status="detail.status" />
          <span class="eyebrow">UPDATED {{ formatDate(detail.updated_at) }}</span>
        </div>
        <h1 class="display-lg mt-3 max-w-[24ch]">{{ detail.title }}</h1>
        <p v-if="detail.subtitle" class="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-dim md:text-[16px]">
          {{ detail.subtitle }}
        </p>
      </header>

      <div class="card tick-frame mt-8 overflow-hidden">
        <div class="cover">
          <ImageWithFallback :src="detail.cover_url" :alt="`${detail.title} 封面`" :letter="letter" eager />
        </div>
      </div>

      <div class="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <article data-article class="min-w-0">
          <section v-if="meta.highlights.length" class="mb-8 rounded-[12px] border border-line bg-surface/60 p-5">
            <p class="eyebrow">HIGHLIGHTS</p>
            <ul class="mt-3 space-y-2">
              <li v-for="item in meta.highlights" :key="item" class="flex items-start gap-2 text-[13.5px]">
                <Check :size="15" class="mt-0.5 shrink-0 text-success" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </section>

          <MarkdownViewer v-if="detail.summary" :source="detail.summary" />
          <p v-else class="text-[13.5px] text-dim">正文还在整理，先看右侧信息与外部链接。</p>
        </article>

        <aside class="space-y-4 lg:sticky lg:top-24">
          <nav v-if="toc.length" class="card no-print hidden p-4 lg:block" aria-label="目录">
            <p class="eyebrow">CONTENTS</p>
            <ul class="mt-3 space-y-1.5 border-l border-line pl-3">
              <li v-for="item in toc" :key="item.id">
                <a
                  :href="`#${item.id}`"
                  class="block py-0.5 text-[12.5px] transition-colors"
                  :class="[
                    item.level === 3 ? 'pl-3' : '',
                    activeHeading === item.id ? 'text-primary' : 'text-dim hover:text-ink',
                  ]"
                  @click.prevent="scrollTo(item.id)"
                >
                  {{ item.text }}
                </a>
              </li>
            </ul>
          </nav>

          <div class="card p-5">
            <div class="flex items-center justify-between gap-3">
              <p class="eyebrow">DOSSIER</p>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-[11.5px] text-dim transition-colors hover:text-primary"
                @click="copyLink"
              >
                <Copy :size="12" /> 复制链接
              </button>
            </div>

            <dl class="mt-4 space-y-0 text-[12.5px]">
              <div v-if="meta.role" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><UserRound :size="13" /> 角色</dt>
                <dd class="text-right">{{ meta.role }}</dd>
              </div>
              <div v-if="period" class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="flex shrink-0 items-center gap-1.5 text-dim"><CalendarRange :size="13" /> 周期</dt>
                <dd class="num text-right">{{ period }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="shrink-0 text-dim">状态</dt>
                <dd class="text-right">{{ STATUS_LABEL[detail.status] }}</dd>
              </div>
              <div v-if="detail.category" class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-dim">分类</dt>
                <dd class="text-right">{{ detail.category }}</dd>
              </div>
            </dl>

            <div v-if="meta.metrics.length" class="mt-4 grid grid-cols-2 gap-2">
              <div
                v-for="metric in meta.metrics"
                :key="metric.label"
                class="rounded-[9px] border border-line bg-bg px-3 py-2.5"
              >
                <p class="num text-[18px] leading-none">{{ metric.value }}</p>
                <p class="mt-1.5 text-[11px] text-dim">{{ metric.label }}</p>
              </div>
            </div>

            <div v-if="detail.tags.length" class="mt-4 flex flex-wrap gap-1.5">
              <TagPill v-for="tag in detail.tags" :key="tag.id" :name="tag.name" :kind="tag.kind" />
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
                <span class="inline-flex items-center gap-2">
                  <component :is="linkIcon[link.type] || Link2" :size="14" />
                  {{ link.label }}
                </span>
                <span class="eyebrow text-[9px]">{{ LINK_TYPE_LABEL[link.type] }}</span>
              </a>
            </div>
          </div>

          <p class="px-1 text-[11px] leading-relaxed text-dim">
            最近更新 {{ formatDate(detail.updated_at) }}。文中数据已脱敏，保留可验证的口径。
          </p>
        </aside>
      </div>

      <section v-if="related.length" class="section !pb-0">
        <div class="mb-6 flex items-center gap-3">
          <span class="eyebrow">RELATED</span>
          <span class="h-px flex-1 bg-line opacity-60" />
        </div>
        <div class="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          <WorkCard v-for="(item, i) in related" :key="item.id" :work="item" :index="i + 1" />
        </div>
      </section>
    </template>
  </PageContainer>
</template>
