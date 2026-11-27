<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowUpRight, Award, Briefcase, GraduationCap } from 'lucide-vue-next'
import { listWorks } from '@/api/works'
import { SKILLS, parseAppMeta, type WorkWithTags } from '@/db/types'
import { applySeo } from '@/lib/seo'
import { formatDate, yearsSince } from '@/lib/utils'
import { useSiteStore } from '@/stores/site'
import { useReveal } from '@/composables/useReveal'
import PageContainer from '@/components/PageContainer.vue'
import SectionHeading from '@/components/SectionHeading.vue'

const site = useSiteStore()
const items = ref<WorkWithTags[]>([])
const loading = ref(true)
const { refresh } = useReveal()

const years = computed(() => yearsSince(site.profile.since || 2024))

const timeline = computed(() => {
  const list = items.value
    .map((work) => ({
      id: `${work.kind}-${work.id}`,
      kind: work.kind,
      title: work.title,
      date: work.finished_at || work.started_at || work.updated_at,
      sortKey: (work.finished_at || work.started_at || work.updated_at).slice(0, 7),
      slug: work.slug,
      note:
        work.kind === 'app'
          ? `${parseAppMeta(work.meta).case_count} 条用例 · ${parseAppMeta(work.meta).bug_total} 个缺陷`
          : work.category || '项目',
    }))
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const groups = new Map<string, typeof list>()
  for (const entry of list) {
    const year = entry.sortKey.slice(0, 4)
    const bucket = groups.get(year) ?? []
    bucket.push(entry)
    groups.set(year, bucket)
  }
  return Array.from(groups.entries()).map(([year, entries]) => ({ year, entries }))
})

const experiences = [
  {
    icon: GraduationCap,
    label: '教育背景',
    title: '重庆移通学院 · 计算机科学与技术',
    meta: '本科 · 2021 — 2025',
    lines: ['2025 届优秀毕业生', '专业方向：软件测试与质量保障'],
  },
  {
    icon: Briefcase,
    label: '实习经历',
    title: '成都沁园赢欣文化科技有限公司 · 测试工程师',
    meta: '2024.11 — 2025.06',
    lines: [
      '按等价类、边界值、场景分析拆需求，编写并执行测试用例',
      'Windows 搭建测试环境，禅道提交缺陷并跟进回归',
      'Fiddler 抓包定位前后端问题，输出修复建议',
    ],
  },
]

const honors = [
  { title: '中国机器人及人工智能大赛 · 智能驾驶赛', meta: '国家级二等奖 / 重庆赛区二等奖 · 2021—2022' },
  { title: '优秀学生奖学金 三等奖（2 次）', meta: '2021—2022 · 2024—2025' },
  { title: '「自立自强先进个人」· 2025 届优秀毕业生', meta: '重庆移通学院 · 2024—2025' },
  { title: '人工智能训练师（国家级）· 普通话三级甲等', meta: '2021—2022' },
  { title: '人形机器人 / 智能感知系统（嵌入式）实习实训', meta: '结业证书 · 2023—2024' },
]

const principles = [
  {
    index: '01',
    title: '从失败路径出发',
    body: '需求进来先拆异常：谁能操作、数据怎么错、网络断了会怎样。测试点从风险出发，不从页面出发。',
  },
  {
    index: '02',
    title: '重复三次就自动化',
    body: '稳定的回归用 Selenium 和 PageObject 固化，接口层用 Requests 校验，把人力留给探索性测试。',
  },
  {
    index: '03',
    title: '缺陷要闭环',
    body: '提交不是终点。跟进修复、验证回归、补用例、写复盘，让同一个问题不以另一种形式再来一次。',
  },
]

async function load() {
  loading.value = true
  try {
    const [works, apps] = await Promise.all([
      listWorks({ kind: 'work', limit: 200 }),
      listWorks({ kind: 'app', limit: 200 }),
    ])
    items.value = [...works, ...apps]
    refresh()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  applySeo({
    title: '关于 · 张福建',
    description: '重庆移通学院计算机科学与技术 2025 届。测试工程师：黑盒 / 白盒测试、Selenium 自动化、接口与性能验证。',
  })
  site.load()
  load()
})
</script>

<template>
  <PageContainer>
    <header class="relative overflow-hidden pb-12 pt-12 md:pb-16 md:pt-20">
      <div class="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div class="relative">
        <div class="flex items-center gap-3">
          <span class="index-tag">ABOUT</span>
          <span class="hairline flex-1" />
          <span class="num text-[10px] text-dim">{{ years }} YRS / QC</span>
        </div>
        <h1 class="display-lg mt-6 max-w-[20ch]">把「能跑」变成「可靠」。</h1>
        <p class="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-dim md:text-[16px]">
          我是{{ site.profile.name }}，重庆移通学院计算机科学与技术 2025 届。做过酒店后台、电商平台与移动 App
          的完整测试闭环：写用例、跑流程、提缺陷、跟回归。也写 Vue，能从代码层判断前端缺陷。
        </p>
        <div class="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-dim">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-success" />{{ site.profile.availability || '求职中' }}
          </span>
          <span>{{ site.profile.location || '重庆' }}</span>
          <a v-if="site.profile.email" :href="`mailto:${site.profile.email}`" class="link-underline hover:text-primary">
            {{ site.profile.email }}
          </a>
        </div>
      </div>
    </header>

    <section class="reveal grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-4">
        <article v-for="item in experiences" :key="item.label" class="card p-5 md:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <component :is="item.icon" :size="16" />
              </span>
              <span class="eyebrow">{{ item.label }}</span>
            </div>
            <span class="num shrink-0 text-[10.5px] text-dim">{{ item.meta }}</span>
          </div>
          <h2 class="font-display mt-4 text-[19px] leading-snug">{{ item.title }}</h2>
          <ul class="mt-3 space-y-1.5">
            <li v-for="line in item.lines" :key="line" class="flex gap-2 text-[12.5px] leading-relaxed text-dim">
              <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
              <span>{{ line }}</span>
            </li>
          </ul>
        </article>
      </div>

      <aside class="card tick-frame p-5 md:p-6">
        <div class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 place-items-center rounded-full border border-warn/30 bg-warn/10 text-warn">
            <Award :size="16" />
          </span>
          <span class="eyebrow">HONORS / 奖项与证书</span>
        </div>
        <ul class="mt-4 divide-y divide-line/70">
          <li v-for="item in honors" :key="item.title" class="py-3 first:pt-1">
            <p class="text-[12.5px] leading-snug">{{ item.title }}</p>
            <p class="num mt-1 text-[10px] text-dim">{{ item.meta }}</p>
          </li>
        </ul>
      </aside>
    </section>

    <section class="section">
      <SectionHeading index="01 / PRINCIPLES" title="工作方式" />
      <div class="grid gap-4 md:grid-cols-3">
        <div v-for="item in principles" :key="item.index" class="card card-hover p-5 md:p-6">
          <span class="num text-[11px] text-primary">{{ item.index }}</span>
          <h2 class="font-display mt-3 text-[19px]">{{ item.title }}</h2>
          <p class="mt-2.5 text-[13px] leading-relaxed text-dim">{{ item.body }}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <SectionHeading index="02 / TIMELINE" title="做过的与测过的" />
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-16" />
      </div>
      <div v-else class="space-y-9">
        <div v-for="group in timeline" :key="group.year">
          <div class="flex items-center gap-3">
            <span class="num text-[13px] text-primary">{{ group.year }}</span>
            <span class="hairline flex-1" />
          </div>
          <ul class="mt-3 border-l border-line pl-4 md:pl-6">
            <li v-for="entry in group.entries" :key="entry.id" class="relative py-2.5">
              <span
                class="absolute -left-[21px] top-[17px] h-1.5 w-1.5 rounded-full border border-primary bg-bg md:-left-[29px]"
                aria-hidden="true"
              />
              <RouterLink
                :to="`/${entry.kind === 'app' ? 'apps' : 'works'}/${entry.slug}`"
                class="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span class="inline-flex items-baseline gap-2">
                  <span class="text-[14px] transition-colors group-hover:text-primary">{{ entry.title }}</span>
                  <span class="eyebrow text-[9px]">{{ entry.kind === 'app' ? 'TEST' : 'BUILD' }}</span>
                </span>
                <span class="num text-[11px] text-dim">{{ formatDate(entry.date, 'YYYY.MM') }}</span>
              </RouterLink>
              <p class="mt-0.5 text-[11.5px] text-dim">{{ entry.note }}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section">
      <SectionHeading index="03 / CAPABILITY" title="技能矩阵" />
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="(group, i) in SKILLS" :key="group.group" class="card card-hover p-5">
          <div class="flex items-baseline justify-between">
            <h3 class="font-display text-[18px]">{{ group.group }}</h3>
            <span class="num text-[10px] text-dim">0{{ i + 1 }}</span>
          </div>
          <div class="mt-3.5 flex flex-wrap gap-1.5">
            <span v-for="item in group.items" :key="item" class="chip">{{ item }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="card tick-frame flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p class="font-display text-[clamp(20px,2.6vw,26px)]">简历里有更完整的时间线。</p>
          <p class="mt-2 text-[13px] text-dim">可打印版本，A4 排版，适合面试现场直接递给对方。</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <RouterLink to="/resume" class="btn btn-primary">
            查看简历 <ArrowUpRight :size="15" />
          </RouterLink>
          <a v-if="site.profile.email" :href="`mailto:${site.profile.email}`" class="btn">发邮件</a>
        </div>
      </div>
    </section>
  </PageContainer>
</template>
