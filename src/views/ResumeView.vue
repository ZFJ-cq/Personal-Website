<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ArrowLeft, Printer } from 'lucide-vue-next'
import { PROFILE_FALLBACK } from '@/db/types'
import { applySeo } from '@/lib/seo'
import { useSiteStore } from '@/stores/site'
import PageContainer from '@/components/PageContainer.vue'

const site = useSiteStore()
const profile = computed(() => site.profile)
const phone = computed(() => profile.value.phone || '')
const school = computed(() => profile.value.school || PROFILE_FALLBACK.school)
const major = computed(() => profile.value.major || PROFILE_FALLBACK.major)
const degree = computed(() => profile.value.degree || PROFILE_FALLBACK.degree)
const gradYear = computed(() => profile.value.gradYear || PROFILE_FALLBACK.gradYear)
const schoolPeriod = computed(() => profile.value.schoolPeriod || '2021.09 — 2025.06')
const gradYearNumber = computed(() => gradYear.value.match(/\d{4}/)?.[0] || String(new Date().getFullYear()))

const skills = [
  {
    title: '测试理论',
    body: '熟悉软件测试流程与国军标规范（GJB141、GJB438B、324 测试方法）；掌握黑盒（等价类、边界值）与白盒（语句覆盖、分支覆盖）测试方法。',
  },
  {
    title: '用例设计',
    body: '熟练使用 Xmind 拆解测试点，结合等价类、边界值、场景分析、正交试验设计用例，保障业务场景覆盖率。',
  },
  {
    title: '自动化',
    body: 'Selenium WebDriver 元素定位、断言、异常处理与 PageObject 设计模式；Python + Requests 做接口测试，BeautifulReport 输出可视化报告。',
  },
  {
    title: '工具链',
    body: '禅道 / Jira 缺陷全流程管理；Fiddler、F12 抓包定位；Postman 接口验证、JMeter 基础性能分析；MySQL 增删改查与存储过程；Linux / FinalShell 搭建测试环境。',
  },
  {
    title: '开发协作',
    body: '熟悉 Vue 框架原理，可定位组件渲染与数据绑定缺陷；具备 C / Java 代码阅读能力，可辅助单元测试与代码评审。',
  },
]

const projects = [
  {
    title: '古剑酒店后台管理系统测试',
    meta: '200+ 用例 · 50+ 缺陷 · 功能点 100% 覆盖',
    scope: '用户登记、收银结账、营业信息查询等酒店日常运营功能。',
    points: [
      '基于 IEEE 829 独立设计并执行 200+ 条测试用例，用正交试验与场景分析法实现功能点 100% 覆盖。',
      '参与动态用例评审机制建设，提出多项优化建议，推动测试覆盖率提升约 30%。',
      '用禅道完成 50+ 个缺陷的提交、跟踪与分类，附复现步骤与影响范围，协助开发定位直至全部闭环。',
    ],
  },
  {
    title: '悦购电商平台（Web 端）测试',
    meta: '300+ 用例 · 150+ 缺陷 · 接口 + 性能',
    scope: '商品浏览与购买、优惠促销、订单与售后等 Web 电商流程。',
    points: [
      '独立设计并执行 300+ 条用例，覆盖主流程与异常分支，测试覆盖率提升约 30%。',
      '用禅道全流程管理 150+ 个缺陷，详细记录复现步骤与影响范围，配合开发定位并完成回归。',
      '用 Postman、JMeter 完成接口功能验证与基础性能指标分析，把接口问题挡在提测前。',
    ],
  },
]

const honors = computed(() => [
  '中国机器人及人工智能大赛（国家级）总决赛 · 智能驾驶赛二等奖（2021—2022）',
  '中国机器人及人工智能大赛（省部级）重庆赛区 · 智能驾驶赛二等奖（2021—2022）',
  '优秀学生奖学金三等奖（2 次）· 2021—2022、2024—2025',
  `${school.value}「自立自强先进个人」· ${gradYear.value}「优秀毕业生」（2024—2025）`,
  '人工智能训练师证（国家级）· 普通话三级甲等（2021—2022）',
  '人形机器人实习实训、百科荣创智能感知系统（嵌入式）实习实训结业证书（2023—2024）',
])

function printPage() {
  window.print()
}

onMounted(() => {
  applySeo({
    title: `简历 · ${profile.value.name}`,
    description: `${profile.value.name} 的简历：${school.value}${major.value} ${gradYear.value}，测试工程师方向，酒店后台、电商平台与移动 App 测试经验。`,
  })
  site.load()
})
</script>

<template>
  <PageContainer>
    <div class="no-print flex flex-wrap items-center justify-between gap-3 py-6">
      <RouterLink to="/about" class="inline-flex items-center gap-1.5 text-[12.5px] text-dim hover:text-primary">
        <ArrowLeft :size="14" /> 返回关于
      </RouterLink>
      <div class="flex items-center gap-2">
        <span class="eyebrow hidden sm:block">A4 / PRINT READY</span>
        <button type="button" class="btn btn-primary btn-sm" @click="printPage">
          <Printer :size="14" /> 打印 / 存为 PDF
        </button>
      </div>
    </div>

    <article class="resume-sheet mx-auto max-w-[860px] px-6 py-8 md:px-10 md:py-12">
      <div class="resume-accent" aria-hidden="true" />

      <header class="flex flex-col gap-5 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="resume-kicker">RESUME / {{ gradYearNumber }}</p>
          <h1 class="font-display mt-2 text-[clamp(30px,5vw,44px)] leading-none tracking-tight">
            {{ profile.name }}
          </h1>
          <p class="mt-2.5 text-[13px] opacity-80">求职意向：测试工程师</p>
          <p class="mt-1 text-[11.5px] opacity-55">{{ school }} · {{ major }}（{{ degree }}）· {{ gradYear }}</p>
        </div>
        <div class="grid gap-1 text-[11.5px] opacity-75 md:text-right">
          <p v-if="phone" class="num">电话　{{ phone }}</p>
          <p v-if="profile.email" class="break-anywhere">邮箱　{{ profile.email }}</p>
          <p>籍贯　{{ profile.location || PROFILE_FALLBACK.location }}</p>
          <p class="num">状态　{{ profile.availability || '求职中' }}</p>
        </div>
      </header>

      <section>
        <h2 class="resume-h">教育背景</h2>
        <div class="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-[13px] font-semibold">{{ school }} · {{ major }}</p>
          <span class="num text-[10.5px] opacity-60">{{ schoolPeriod }}</span>
        </div>
        <p class="mt-1 text-[11.5px] leading-relaxed opacity-75">
          {{ degree }} · {{ gradYear }}优秀毕业生 · 在校获优秀学生奖学金三等奖 2 次 · 「自立自强先进个人」。
        </p>
      </section>

      <section class="mt-5">
        <h2 class="resume-h">专业技能</h2>
        <ul class="mt-2 space-y-1.5">
          <li v-for="item in skills" :key="item.title" class="text-[11.5px] leading-relaxed">
            <span class="font-semibold">{{ item.title }}：</span>
            <span class="opacity-80">{{ item.body }}</span>
          </li>
        </ul>
      </section>

      <section class="mt-5">
        <h2 class="resume-h">实习经历</h2>
        <div class="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-[13px] font-semibold">成都沁园赢欣文化科技有限公司 · 测试工程师</p>
          <span class="num text-[10.5px] opacity-60">2024.11 — 2025.06</span>
        </div>
        <ul class="mt-1.5 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed opacity-80">
          <li>根据需求使用等价类、边界值、场景分析法设计并编写测试用例。</li>
          <li>使用 Windows 系统搭建测试环境，执行测试并记录结果。</li>
          <li>通过禅道提交 Bug，与开发确认后追溯修复进度并完成回归测试。</li>
          <li>通过 Fiddler 抓包定位缺陷，提交问题并给出修复建议。</li>
        </ul>
      </section>

      <section class="mt-5">
        <h2 class="resume-h">项目经历</h2>
        <div v-for="project in projects" :key="project.title" class="mt-3 first:mt-2">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-[12.5px] font-semibold">{{ project.title }}</p>
            <span class="text-[10.5px] opacity-60">{{ project.meta }}</span>
          </div>
          <p class="mt-0.5 text-[11.5px] leading-relaxed opacity-70">{{ project.scope }}</p>
          <ul class="mt-1.5 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed opacity-80">
            <li v-for="point in project.points" :key="point">{{ point }}</li>
          </ul>
        </div>
      </section>

      <div class="mt-5 grid gap-5 md:grid-cols-[1.35fr_0.65fr]">
        <section>
          <h2 class="resume-h">奖项荣誉</h2>
          <ul class="mt-2 space-y-1 text-[11.5px] leading-relaxed opacity-80">
            <li v-for="item in honors" :key="item" class="flex gap-1.5">
              <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" aria-hidden="true" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 class="resume-h">自我评价</h2>
          <p class="mt-2 text-[11.5px] leading-relaxed opacity-80">
            逻辑缜密、执行力强，能快速融入新环境与高强度节奏；对问题习惯先拆解再验证，愿意在测试方向长期积累。
          </p>
          <p class="mt-2 text-[11.5px] leading-relaxed opacity-80">
            有计算机专业背景与代码阅读能力，能和开发在同一语境里讨论缺陷，而不只是「复现不了」。
          </p>
        </section>
      </div>

      <footer class="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-current/15 pt-3 text-[10px] opacity-50">
        <span>{{ profile.name }} · {{ profile.role || PROFILE_FALLBACK.role }}</span>
        <span class="num">PORTFOLIO / {{ profile.email }}</span>
      </footer>
    </article>
  </PageContainer>
</template>

<style scoped>
.resume-sheet {
  position: relative;
  background: #fdfcf8;
  color: #15181d;
  border: 1px solid #ddd8cc;
  border-radius: 8px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 24px 60px -24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.resume-accent {
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, #1e62d8, #3b82f6 45%, #8ab4f8 100%);
}
.resume-kicker {
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 9.5px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.5;
}
.resume-h {
  font-family: 'SFMono-Regular', Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.55;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(21, 24, 29, 0.16);
}
@media print {
  .resume-sheet {
    max-width: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    color: #000;
    padding: 0;
  }
  .resume-accent {
    display: none;
  }
  .resume-h {
    opacity: 1;
    border-color: #bbb;
  }
}
</style>
