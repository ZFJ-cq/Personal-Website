<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  BarChart3,
  Check,
  Database,
  HardDriveDownload,
  LayoutGrid,
  Link2,
  Palette,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import type { SettingKey } from '@/db/defaults'
import type { SiteSettings } from '@/db/types'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import { setTheme } from '@/composables/useTheme'
import { clearNoTrack, isNoTrack, markNoTrack } from '@/analytics/collect'
import ImageUploader from '@/components/admin/ImageUploader.vue'

const site = useSiteStore()
const { toast } = useToast()

const tabs = [
  { key: 'profile' as SettingKey, label: '个人资料', icon: UserRound },
  { key: 'social' as SettingKey, label: '社交链接', icon: Link2 },
  { key: 'seo' as SettingKey, label: 'SEO', icon: Search },
  { key: 'theme' as SettingKey, label: '主题', icon: Palette },
  { key: 'modules' as SettingKey, label: '首页模块', icon: LayoutGrid },
  { key: 'analytics' as SettingKey, label: '统计', icon: BarChart3 },
]

const active = ref<SettingKey>('profile')
const saving = ref(false)
const draft = reactive<SiteSettings>(JSON.parse(JSON.stringify(site.settings)))
const presets = ['#3b82f6', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7']
const noTrack = ref(isNoTrack())
const moduleLabels: Record<keyof SiteSettings['modules'], string> = {
  stats: '数字条',
  featured: '精选作品',
  apps: '测试过的 App',
  skills: '能力矩阵',
  contact: '联系方式',
}
const moduleRows = computed(() =>
  (Object.keys(draft.modules) as Array<keyof SiteSettings['modules']>).map((key) => ({
    key,
    label: moduleLabels[key],
  })),
)

function toggleModule(key: keyof SiteSettings['modules']) {
  draft.modules[key] = !draft.modules[key]
}

const current = computed(() => tabs.find((tab) => tab.key === active.value)?.label ?? '')
const seoPreview = computed(() => ({
  title: draft.seo.title || `${draft.profile.name} · ${draft.profile.role}`,
  description: draft.seo.description || draft.profile.tagline,
  url: `${location.host}${import.meta.env.BASE_URL}`,
}))

function addSocial() {
  draft.social.push({ platform: '', label: '', url: 'https://', icon: 'link' })
}

function removeSocial(index: number) {
  draft.social.splice(index, 1)
}

function moveSocial(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= draft.social.length) return
  const temp = draft.social[index]
  draft.social[index] = draft.social[next]
  draft.social[next] = temp
}

async function save(key: SettingKey = active.value) {
  if (saving.value) return
  if (key === 'profile' && (!draft.profile.name.trim() || draft.profile.name.trim().length < 2)) {
    toast('姓名至少 2 个字', 'error')
    return
  }
  if (key === 'social') {
    const invalid = draft.social.some((item) => !item.platform.trim() || !item.url.trim())
    if (invalid) {
      toast('社交链接的平台与地址不能为空', 'error')
      return
    }
  }
  saving.value = true
  try {
    await site.persist(key, draft[key])
    if (key === 'theme') setTheme(draft.theme.mode)
    toast(`已保存「${tabs.find((t) => t.key === key)?.label}」`)
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

function toggleNoTrack() {
  if (noTrack.value) {
    clearNoTrack()
    noTrack.value = false
    toast('已恢复本机统计上报', 'info')
  } else {
    markNoTrack()
    noTrack.value = true
    toast('本机已标记为站长，不再上报', 'info')
  }
}

onMounted(async () => {
  document.title = '站点设置 · 内容后台'
  await site.load(true)
  Object.assign(draft, JSON.parse(JSON.stringify(site.settings)))
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">CONFIG / SETTINGS</p>
        <h1 class="mt-2 text-[22px] font-semibold">站点设置</h1>
        <p class="mt-1 text-[12.5px] text-dim">当前编辑：{{ current }}。保存后立即写入数据源，前台刷新可见。</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save()">
        <Save :size="14" /> {{ saving ? '保存中…' : '保存当前页' }}
      </button>
    </header>

    <div class="grid items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
      <nav class="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible" aria-label="设置分组">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] transition-colors"
          :class="active === tab.key ? 'bg-surface2 text-ink' : 'text-dim hover:bg-surface hover:text-ink'"
          @click="active = tab.key"
        >
          <component :is="tab.icon" :size="15" :class="active === tab.key ? 'text-primary' : ''" />
          {{ tab.label }}
        </button>
      </nav>

      <div class="space-y-5">
        <section v-if="active === 'profile'" class="card p-4 md:p-6">
          <h2 class="text-[14px] font-medium">个人资料</h2>
          <p class="mt-1 text-[11.5px] text-dim">这些字段会出现在首页 Hero、页脚与简历。</p>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label for="s-name" class="field-label">姓名 <span class="req">*</span></label>
              <input id="s-name" v-model="draft.profile.name" class="input" maxlength="20" />
            </div>
            <div>
              <label for="s-enname" class="field-label">英文名</label>
              <input id="s-enname" v-model="draft.profile.enName" class="input" placeholder="Zhang Fujian" />
            </div>
            <div class="md:col-span-2">
              <label for="s-tagline" class="field-label">定位语（≤ 20 字）</label>
              <input id="s-tagline" v-model="draft.profile.tagline" class="input" maxlength="40" placeholder="测试工程师，写代码也写测试用例。" />
            </div>
            <div class="md:col-span-2">
              <label for="s-intro" class="field-label">首页简介</label>
              <textarea
                id="s-intro"
                v-model="draft.profile.intro"
                class="textarea !min-h-[72px]"
                maxlength="200"
                placeholder="留空则使用内置介绍文案"
              />
            </div>
            <div>
              <label for="s-focus" class="field-label">首页 FOCUS</label>
              <input id="s-focus" v-model="draft.profile.focus" class="input" placeholder="功能 · 接口 · 自动化" />
            </div>
            <div>
              <label for="s-honor" class="field-label">首页 HONOR</label>
              <input id="s-honor" v-model="draft.profile.honor" class="input" placeholder="国赛二等奖 ×2" />
            </div>
            <div>
              <label for="s-role" class="field-label">角色</label>
              <input id="s-role" v-model="draft.profile.role" class="input" placeholder="测试工程师" />
            </div>
            <div>
              <label for="s-availability" class="field-label">当前状态</label>
              <input id="s-availability" v-model="draft.profile.availability" class="input" placeholder="可接质量保障 / 前端协作" />
            </div>
            <div>
              <label for="s-email" class="field-label">邮箱</label>
              <input id="s-email" v-model="draft.profile.email" type="email" class="input" />
            </div>
            <div>
              <label for="s-location" class="field-label">城市</label>
              <input id="s-location" v-model="draft.profile.location" class="input" />
            </div>
            <div>
              <label for="s-resume" class="field-label">简历链接</label>
              <input id="s-resume" v-model="draft.profile.resumeUrl" class="input" placeholder="/resume 或 https://…" />
            </div>
            <div>
              <label for="s-since" class="field-label">从业起始年</label>
              <input id="s-since" v-model.number="draft.profile.since" type="number" min="1990" max="2100" class="input num" />
            </div>
            <div class="md:col-span-2">
              <ImageUploader
                v-model="draft.profile.avatar"
                label="头像"
                hint="1:1，留空用首字母占位"
                aspect="square"
              />
            </div>
          </div>
        </section>

        <section v-else-if="active === 'social'" class="card p-4 md:p-6">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-[14px] font-medium">社交链接</h2>
              <p class="mt-1 text-[11.5px] text-dim">按顺序展示在首页与页脚。</p>
            </div>
            <button type="button" class="btn btn-sm" @click="addSocial"><Plus :size="13" /> 添加</button>
          </div>
          <div class="mt-5 space-y-3">
            <div v-for="(item, index) in draft.social" :key="index" class="rounded-[10px] border border-line bg-bg p-3">
              <div class="grid gap-2 md:grid-cols-3">
                <input v-model="item.platform" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="平台，如 GitHub" />
                <input v-model="item.label" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="展示文本，如 github.com" />
                <input v-model="item.icon" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="图标标识，如 github" />
              </div>
              <div class="mt-2 flex items-center gap-2">
                <input v-model="item.url" class="input !h-9 !min-h-0 flex-1 !text-[12.5px]" placeholder="https://… 或 mailto:…" />
                <button type="button" class="icon-btn !h-8 !w-8" aria-label="上移" :disabled="index === 0" @click="moveSocial(index, -1)">↑</button>
                <button type="button" class="icon-btn !h-8 !w-8" aria-label="下移" :disabled="index === draft.social.length - 1" @click="moveSocial(index, 1)">↓</button>
                <button type="button" class="icon-btn !h-8 !w-8 hover:!text-danger" aria-label="删除" @click="removeSocial(index)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
            <p v-if="!draft.social.length" class="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[12px] text-dim">
              还没有社交链接。
            </p>
          </div>
        </section>

        <section v-else-if="active === 'seo'" class="card p-4 md:p-6">
          <h2 class="text-[14px] font-medium">SEO 与分享</h2>
          <p class="mt-1 text-[11.5px] text-dim">标题 ≤ 60 字，描述 ≤ 160 字。详情页会自动使用内容自身的标题与摘要。</p>
          <div class="mt-5 space-y-4">
            <div>
              <label for="s-seotitle" class="field-label">站点标题</label>
              <input id="s-seotitle" v-model="draft.seo.title" class="input" maxlength="60" />
            </div>
            <div>
              <label for="s-seodesc" class="field-label">站点描述</label>
              <textarea id="s-seodesc" v-model="draft.seo.description" class="textarea !min-h-[80px]" maxlength="160" />
            </div>
            <div>
              <label for="s-keywords" class="field-label">关键词（逗号分隔）</label>
              <input id="s-keywords" v-model="draft.seo.keywords" class="input" />
            </div>
            <div>
              <label for="s-og" class="field-label">分享图 URL（1200×630）</label>
              <input id="s-og" v-model="draft.seo.ogImage" class="input" placeholder="https://…" />
            </div>
            <div class="rounded-[10px] border border-line bg-surface/60 p-4">
              <p class="eyebrow">SEARCH PREVIEW</p>
              <p class="mt-2 text-[12px] text-primary">{{ seoPreview.url }}</p>
              <p class="mt-1 text-[15px] text-[#8ab4f8]">{{ seoPreview.title }}</p>
              <p class="mt-1 text-[12px] leading-relaxed text-dim">{{ seoPreview.description }}</p>
            </div>
          </div>
        </section>

        <section v-else-if="active === 'theme'" class="card p-4 md:p-6">
          <h2 class="text-[14px] font-medium">主题</h2>
          <p class="mt-1 text-[11.5px] text-dim">主色保存后立即注入 CSS 变量；明暗模式同时写入本机偏好。</p>
          <div class="mt-5">
            <span class="field-label">主色</span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="color in presets"
                :key="color"
                type="button"
                class="relative h-9 w-9 rounded-full border border-line"
                :style="{ background: color }"
                :aria-label="`使用主色 ${color}`"
                @click="draft.theme.primary = color"
              >
                <Check v-if="draft.theme.primary.toLowerCase() === color" :size="15" class="absolute inset-0 m-auto text-white" />
              </button>
              <label class="inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-2 py-1.5">
                <input v-model="draft.theme.primary" type="color" class="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                <span class="num text-[11.5px] text-dim">{{ draft.theme.primary }}</span>
              </label>
            </div>
          </div>

          <div class="mt-6">
            <span class="field-label">默认模式</span>
            <div class="segmented">
              <button type="button" :class="{ 'is-active': draft.theme.mode === 'dark' }" @click="draft.theme.mode = 'dark'">深色</button>
              <button type="button" :class="{ 'is-active': draft.theme.mode === 'light' }" @click="draft.theme.mode = 'light'">浅色</button>
            </div>
            <p class="mt-2 text-[11px] text-dim">访客首次访问跟随系统；手动切换后会记住本机选择。</p>
          </div>

          <div class="mt-6 rounded-[10px] border border-line bg-bg p-4">
            <p class="eyebrow">PREVIEW</p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-primary btn-sm" :style="{ background: draft.theme.primary, borderColor: draft.theme.primary }">主按钮</button>
              <span class="chip is-active">激活标签</span>
              <span class="badge badge-done">通过</span>
              <span class="font-display text-[18px]" :style="{ color: draft.theme.primary }">Aa 标题</span>
            </div>
          </div>
        </section>

        <section v-else-if="active === 'modules'" class="card p-4 md:p-6">
          <h2 class="text-[14px] font-medium">首页模块开关</h2>
          <p class="mt-1 text-[11.5px] text-dim">关闭后该模块不在首页渲染，数据仍保留。</p>
          <div class="mt-5 divide-y divide-line/70">
            <div v-for="item in moduleRows" :key="item.key" class="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p class="text-[12.5px]">{{ item.label }}</p>
                <p class="num mt-0.5 text-[10px] text-dim">{{ item.key }}</p>
              </div>
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': draft.modules[item.key] }"
                role="switch"
                :aria-checked="draft.modules[item.key]"
                :aria-label="`切换 ${item.label}`"
                @click="toggleModule(item.key)"
              />
            </div>
          </div>
        </section>

        <section v-else class="card p-4 md:p-6">
          <h2 class="text-[14px] font-medium">统计设置</h2>
          <p class="mt-1 text-[11.5px] text-dim">默认写入本地 SQLite 的 visits 表；填写 endpoint 则改为 sendBeacon 上报到外部端点。</p>
          <div class="mt-5 space-y-4">
            <div class="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-bg px-4 py-3">
              <div>
                <p class="text-[12.5px]">启用匿名统计</p>
                <p class="mt-0.5 text-[11px] text-dim">关闭后前台不再上报，历史数据仍可查看。</p>
              </div>
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': draft.analytics.enabled }"
                role="switch"
                :aria-checked="draft.analytics.enabled"
                aria-label="启用统计"
                @click="draft.analytics.enabled = !draft.analytics.enabled"
              />
            </div>
            <div class="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-bg px-4 py-3">
              <div>
                <p class="text-[12.5px]">尊重 DNT</p>
                <p class="mt-0.5 text-[11px] text-dim">浏览器开启「请勿追踪」时不上报。</p>
              </div>
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': draft.analytics.respectDnt }"
                role="switch"
                :aria-checked="draft.analytics.respectDnt"
                aria-label="尊重 DNT"
                @click="draft.analytics.respectDnt = !draft.analytics.respectDnt"
              />
            </div>
            <div>
              <label for="s-endpoint" class="field-label">上报端点（可选）</label>
              <input id="s-endpoint" v-model="draft.analytics.endpoint" class="input" placeholder="留空 = 写入本地 SQLite" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <span class="field-label">采样率</span>
                <div class="segmented">
                  <button type="button" :class="{ 'is-active': draft.analytics.sampleRate === 1 }" @click="draft.analytics.sampleRate = 1">100%</button>
                  <button type="button" :class="{ 'is-active': draft.analytics.sampleRate === 0.5 }" @click="draft.analytics.sampleRate = 0.5">50%</button>
                  <button type="button" :class="{ 'is-active': draft.analytics.sampleRate === 0.1 }" @click="draft.analytics.sampleRate = 0.1">10%</button>
                </div>
              </div>
              <div>
                <label for="s-retention" class="field-label">数据保留（天）</label>
                <input id="s-retention" v-model.number="draft.analytics.retentionDays" type="number" min="7" max="730" class="input num" />
              </div>
            </div>
            <div class="rounded-[10px] border border-line bg-bg p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-[12.5px]">站长自测排除</p>
                  <p class="mt-0.5 text-[11px] text-dim">当前本机{{ noTrack ? '已排除' : '仍在统计' }}。也可访问任意页面加 ?no_track=1。</p>
                </div>
                <button type="button" class="btn btn-sm" @click="toggleNoTrack">{{ noTrack ? '恢复上报' : '标记本机' }}</button>
              </div>
            </div>
          </div>
        </section>

        <section class="card flex flex-wrap items-center gap-2 p-4">
          <span class="eyebrow mr-2">MORE</span>
          <RouterLink to="/admin/tags" class="btn btn-sm">标签管理</RouterLink>
          <RouterLink to="/admin/data" class="btn btn-sm"><HardDriveDownload :size="13" /> 数据管理</RouterLink>
          <RouterLink to="/admin/connect" class="btn btn-sm"><Database :size="13" /> 数据源</RouterLink>
        </section>
      </div>
    </div>
  </div>
</template>
