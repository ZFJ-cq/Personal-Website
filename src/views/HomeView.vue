<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, ArrowUpRight, Download, Mail, MapPin } from 'lucide-vue-next'
import { listWorks } from '@/api/works'
import { SKILLS, type WorkWithTags } from '@/db/types'
import { useSiteStore } from '@/stores/site'
import { applySeo, setJsonLd } from '@/lib/seo'
import { formatCompact, yearsSince } from '@/lib/utils'
import { trackResume } from '@/analytics/collect'
import { useReveal } from '@/composables/useReveal'
import PageContainer from '@/components/PageContainer.vue'
import SectionHeading from '@/components/SectionHeading.vue'
import WorkCard from '@/components/WorkCard.vue'
import AppCard from '@/components/AppCard.vue'
import SkeletonCard from '@/components/SkeletonCard.vue'

const site = useSiteStore()
const works = ref<WorkWithTags[]>([])
const apps = ref<WorkWithTags[]>([])
const loading = ref(true)
const error = ref('')
const { refresh } = useReveal()

const profile = computed(() => site.profile)
const years = computed(() => yearsSince(profile.value.since || 2024))
const heroName = computed(() => profile.value.name || '张福建')
const role = computed(() => profile.value.role || '测试工程师')

const stats = computed(() => [
  { value: formatCompact(site.stats.works), label: '公开作品', sub: 'WORKS' },
  { value: formatCompact(site.stats.apps), label: '被测 App', sub: 'APPS' },
  { value: formatCompact(site.stats.bugs), label: '累计缺陷', sub: 'BUGS FOUND' },
  { value: String(years.value), label: '从业年限', sub: 'YEARS' },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [featured, allWorks, appList] = await Promise.all([
      listWorks({ kind: 'work', featuredOnly: true, limit: 3 }),
      listWorks({ kind: 'work', limit: 3 }),
      listWorks({ kind: 'app', limit: 6 }),
    ])
    works.value = featured.length ? featured : allWorks
    apps.value = appList
    await site.load()
    refresh()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function onResumeClick(event: MouseEvent) {
  const href = profile.value.resumeUrl
  if (!href) {
    event.preventDefault()
    return
  }
  if (href.startsWith('/')) return
  void trackResume('/')
}

onMounted(async () => {
  load()
  const seo = site.settings.seo
  applySeo({
    title: seo.title || `${heroName.value} · ${role.value}`,
    description: seo.description || profile.value.tagline,
    image: seo.ogImage || undefined,
    type: 'website',
  })
  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: heroName.value,
    jobTitle: role.value,
    email: profile.value.email,
    address: profile.value.location,
    url: window.location.origin,
  })
})
</script>

<template>
  <PageContainer>
    <section class="relative overflow-hidden pb-16 pt-10 md:pb-24 md:pt-16">
      <div class="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <span class="glow-orb -left-24 top-6 h-72 w-72" aria-hidden="true" />
      <span class="glow-orb -right-24 top-40 h-80 w-80 opacity-70" aria-hidden="true" />

      <div class="relative grid items-end gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:gap-12">
        <div class="rise">
          <div class="flex flex-wrap items-center gap-3">
            <span class="index-tag">ZF-2026 / DOSSIER</span>
            <span class="hairline hidden w-16 sm:block" />
            <span v-if="profile.availability" class="eyebrow flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              {{ profile.availability }}
            </span>
          </div>

          <h1 class="display-xl mt-7">
            <span class="ink-gradient block">{{ heroName }}</span>
            <span class="mt-3 block font-display text-[clamp(18px,2.7vw,30px)] font-normal tracking-normal text-dim">
              {{ role }}
            </span>
          </h1>

          <p class="font-display mt-8 max-w-[30ch] text-[clamp(24px,3.6vw,38px)] leading-[1.24] text-ink">
            {{ profile.tagline || '把「能跑」变成「可靠」。' }}
          </p>
          <p class="mt-5 max-w-[48ch] text-[14px] leading-relaxed text-dim md:text-[15px]">
            重庆移通学院计算机科学与技术 2025 届。做过酒店后台、电商平台与移动 App 的完整测试闭环；也写 Vue，能从代码层判断前端缺陷。这里只放具体数字，不堆形容词。
          </p>

          <div class="mt-8 flex flex-wrap items-center gap-3">
            <RouterLink to="/works" class="btn btn-primary">
              看作品 <ArrowRight :size="16" />
            </RouterLink>
            <a
              v-if="profile.resumeUrl"
              :href="profile.resumeUrl"
              class="btn"
              :target="profile.resumeUrl.startsWith('/') ? undefined : '_blank'"
              rel="noopener noreferrer"
              @click="onResumeClick"
            >
              <Download :size="16" /> 下载简历
            </a>
            <span v-else class="btn" aria-disabled="true" title="简历链接尚未配置">简历待补充</span>
          </div>

          <div class="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-dim">
            <span v-if="profile.location" class="inline-flex items-center gap-1.5">
              <MapPin :size="14" /> {{ profile.location }}
            </span>
            <a
              v-if="profile.email"
              :href="`mailto:${profile.email}`"
              class="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <Mail :size="14" /> {{ profile.email }}
            </a>
            <RouterLink to="/about" class="link-underline hover:text-ink">关于我</RouterLink>
          </div>
        </div>

        <div class="ring-card rise">
          <aside class="card tick-frame border-0 p-5 md:p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="eyebrow">PROFILE SHEET</p>
                <p class="num mt-1 text-[10px] text-dim">REV. 2026.11 / 001</p>
              </div>
              <span class="badge badge-done">OPEN</span>
            </div>

            <div class="mt-5 flex items-center gap-4">
              <div class="relative shrink-0">
                <div
                  class="font-display grid h-16 w-16 place-items-center rounded-[14px] border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent text-[28px] text-primary"
                >
                  {{ heroName.slice(0, 1) }}
                </div>
                <span class="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-surface bg-success" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="font-display truncate text-[19px]">{{ profile.enName || heroName }}</p>
                <p class="mt-0.5 truncate text-[12px] text-dim">{{ role }}</p>
              </div>
            </div>

            <dl class="mt-6 border-t border-line/80">
              <div class="flex items-center justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="eyebrow">BASE</dt>
                <dd class="text-[12.5px]">{{ profile.location || '—' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="eyebrow">SINCE</dt>
                <dd class="num text-[12.5px]">{{ profile.since }} — NOW</dd>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="eyebrow">FOCUS</dt>
                <dd class="text-[12.5px]">功能 · 接口 · 自动化</dd>
              </div>
              <div class="flex items-center justify-between gap-4 border-b border-line/60 py-2.5">
                <dt class="eyebrow">HONOR</dt>
                <dd class="text-[12.5px]">国赛二等奖 ×2</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="eyebrow">STATUS</dt>
                <dd class="text-[12.5px] text-success">{{ profile.availability || '可沟通' }}</dd>
              </div>
            </dl>

            <div class="mt-5 flex flex-wrap items-center gap-1.5">
              <a
                v-for="item in site.social"
                :key="item.platform"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="chip transition-colors hover:border-primary/50 hover:text-primary"
              >
                {{ item.platform }}
                <ArrowUpRight :size="11" />
              </a>
              <RouterLink to="/resume" class="chip transition-colors hover:border-primary/50 hover:text-primary">
                简历 <ArrowUpRight :size="11" />
              </RouterLink>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="site.modules.stats" class="reveal">
      <div class="card grid grid-cols-2 overflow-hidden md:grid-cols-4">
        <div
          v-for="(item, i) in stats"
          :key="item.sub"
          class="group relative px-5 py-7 transition-colors duration-200 hover:bg-surface2/50 md:px-7 md:py-8"
          :class="[
            i % 2 === 1 ? 'border-l border-line' : '',
            i > 1 ? 'border-t border-line md:border-t-0' : '',
            i === 2 ? 'md:border-l' : '',
            i === 3 ? 'md:border-l' : '',
          ]"
        >
          <span class="absolute left-5 top-3 h-px w-6 bg-primary/50 transition-all duration-300 group-hover:w-10 group-hover:bg-primary md:left-7" aria-hidden="true" />
          <p class="num mt-2 text-[clamp(28px,4vw,40px)] leading-none">{{ item.value }}</p>
          <p class="mt-2.5 text-[13px] text-ink">{{ item.label }}</p>
          <p class="eyebrow mt-1 text-[9px]">{{ item.sub }}</p>
        </div>
      </div>
    </section>

    <section v-if="site.modules.featured" class="section !pt-16 md:!pt-24">
      <SectionHeading index="01 / SELECTED WORK" title="精选作品" link-to="/works" />
      <div v-if="loading" class="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <SkeletonCard v-for="i in 3" :key="i" />
      </div>
      <div v-else-if="error" class="card p-6 text-[13.5px] text-dim">
        数据加载失败：{{ error }}。请刷新重试。
      </div>
      <div v-else-if="works.length" class="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        <WorkCard v-for="(work, i) in works" :key="work.id" :work="work" :index="i + 1" :eager="i === 0" />
      </div>
      <div v-else class="card p-8 text-center text-[13.5px] text-dim">
        还没有公开作品。去后台添加第一条。
      </div>
    </section>

    <section v-if="site.modules.apps" class="section">
      <SectionHeading index="02 / TEST LOG" title="测试过的 App" link-to="/apps" link-text="全部履历" />
      <div v-if="loading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="skeleton h-[150px]" />
      </div>
      <div v-else-if="apps.length" class="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div class="flex w-max gap-4">
          <div v-for="app in apps" :key="app.id" class="w-[282px] shrink-0 md:w-[340px]">
            <AppCard :work="app" />
          </div>
        </div>
      </div>
      <div v-else class="card p-8 text-center text-[13.5px] text-dim">
        暂无测试履历。App 详情会记录用例数、缺陷分布与结论。
      </div>
    </section>

    <section v-if="site.modules.skills" class="section">
      <SectionHeading index="03 / CAPABILITY" title="能力矩阵" />
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="(group, i) in SKILLS" :key="group.group" class="card p-5">
          <div class="flex items-baseline justify-between">
            <h3 class="font-display text-[18px]">{{ group.group }}</h3>
            <span class="num text-[10px] text-dim">0{{ i + 1 }}</span>
          </div>
          <div class="mt-3.5 flex flex-wrap gap-1.5">
            <span v-for="item in group.items" :key="item" class="chip">{{ item }}</span>
          </div>
        </div>
      </div>
      <p class="mt-5 text-[12.5px] leading-relaxed text-dim">
        国军标 GJB141 / GJB438B、IEEE 829 都读过；等价类、边界值、正交试验、场景法都用过。工具是手段，把缺陷关掉才是结果。
      </p>
    </section>

    <section v-if="site.modules.contact" class="section">
      <SectionHeading index="04 / CONTACT" title="保持联系" />
      <div class="card tick-frame overflow-hidden">
        <div class="grid gap-8 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-10">
          <div>
            <p class="font-display max-w-[20ch] text-[clamp(22px,3vw,30px)] leading-snug">
              聊聊质量，或者一起做点东西。
            </p>
            <p class="mt-3 max-w-[42ch] text-[13.5px] leading-relaxed text-dim">
              测试方案、自动化落地、前端协作，都可以从一封邮件开始。一般在 24 小时内回复。
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              <a v-if="profile.email" :href="`mailto:${profile.email}`" class="btn btn-primary">
                <Mail :size="16" /> 发邮件
              </a>
              <RouterLink to="/resume" class="btn">查看简历</RouterLink>
            </div>
          </div>
          <div class="space-y-3 md:border-l md:border-line md:pl-8">
            <div class="flex items-center justify-between gap-4 text-[13px]">
              <span class="eyebrow">EMAIL</span>
              <span class="break-anywhere text-right">{{ profile.email || '—' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 text-[13px]">
              <span class="eyebrow">BASE</span>
              <span>{{ profile.location || '—' }}</span>
            </div>
            <div class="flex items-center justify-between gap-4 text-[13px]">
              <span class="eyebrow">RESPONSE</span>
              <span>≤ 24H</span>
            </div>
            <div class="flex flex-wrap gap-1.5 pt-2">
              <a
                v-for="item in site.social"
                :key="item.platform"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="chip hover:border-primary/50 hover:text-primary"
              >
                {{ item.platform }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </PageContainer>
</template>
