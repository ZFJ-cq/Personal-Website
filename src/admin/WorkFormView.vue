<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-vue-next'
import { createWork, getWorkById, listCategories, listTags, listWorks, updateWork, type WorkInput } from '@/api/works'
import { createTag } from '@/api/tags'
import {
  LINK_TYPE_LABEL,
  TAG_KIND_LABEL,
  parseAppMeta,
  parseWorkMeta,
  type ConclusionLevel,
  type LinkType,
  type Tag,
  type TagKind,
  type WorkStatus,
  type WorkWithTags,
} from '@/db/types'
import { SLUG_PATTERN, safeHttpUrl, slugify } from '@/lib/utils'
import { useToast } from '@/composables/useToast'
import { useSiteStore } from '@/stores/site'
import BaseModal from '@/components/BaseModal.vue'
import WorkCard from '@/components/WorkCard.vue'
import AppCard from '@/components/AppCard.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ImageUploader from '@/components/admin/ImageUploader.vue'

interface LinkRow {
  label: string
  url: string
  type: LinkType
}

interface MetricRow {
  label: string
  value: string
}

const route = useRoute()
const router = useRouter()
const { toast } = useToast()
const site = useSiteStore()

const kind = computed<'work' | 'app'>(() => (route.meta.kind === 'app' ? 'app' : 'work'))
const isApp = computed(() => kind.value === 'app')
const formTitle = computed(() =>
  isEdit.value ? (isApp.value ? '编辑 App' : '编辑作品') : isApp.value ? '新建 App' : '新建作品',
)
const id = computed(() => (route.params.id ? Number(route.params.id) : 0))
const isEdit = computed(() => id.value > 0)
const basePath = computed(() => (isApp.value ? '/admin/apps' : '/admin/works'))

const statuses: WorkStatus[] = ['draft', 'wip', 'done', 'archived']
const statusLabel: Record<WorkStatus, string> = { draft: '草稿', wip: '进行中', done: '已完成', archived: '已归档' }
const levels: ConclusionLevel[] = ['pass', 'conditional', 'fail']
const levelLabel: Record<ConclusionLevel, string> = { pass: '通过', conditional: '有条件通过', fail: '未通过' }
const linkTypes = Object.keys(LINK_TYPE_LABEL) as LinkType[]

const form = reactive({
  title: '',
  subtitle: '',
  slug: '',
  category: '',
  cover_url: '',
  status: 'done' as WorkStatus,
  featured: false,
  sort_order: '0',
  started_at: '',
  finished_at: '',
  summary: '',
  tags: [] as string[],
  links: [] as LinkRow[],
  metrics: [] as MetricRow[],
  role: '',
  highlights: '',
  repo_private: false,
  app: {
    version: '',
    platforms: [] as string[],
    test_types: [] as string[],
    test_scope: '',
    test_cycle: '',
    env: '',
    case_count: '',
    bug_total: '',
    bug_p0: '',
    bug_open: '',
    conclusion: '',
    conclusion_level: 'pass' as ConclusionLevel,
  },
})

const loading = ref(true)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const allTags = ref<Array<Tag & { count: number }>>([])
const categories = ref<string[]>([])
const originalSlug = ref('')
const baseline = ref('')
const slugTouched = ref(false)
const mode = ref<'edit' | 'preview'>('edit')
const previewOpen = ref(false)
const newTag = ref('')
const newTagKind = ref<TagKind>('tech')
const leaveTarget = ref('')
const leaveOpen = ref(false)
let bypassLeave = false

const snapshot = computed(() => JSON.stringify({ kind: kind.value, form }))
const dirty = computed(() => !!baseline.value && snapshot.value !== baseline.value)

const platformOptions = computed(() => {
  const base = ['iOS', 'Android', 'H5', '微信', 'Web', '小程序', 'macOS', 'Windows']
  return Array.from(new Set([...base, ...form.app.platforms]))
})
const testTypeOptions = computed(() => {
  const base = ['功能测试', '兼容性', '性能', '自动化', '安全', '接口', '稳定性']
  return Array.from(new Set([...base, ...form.app.test_types]))
})

const selectedTagObjects = computed<Tag[]>(() =>
  form.tags.map((name) => allTags.value.find((t) => t.name === name) ?? { id: 0, name, kind: 'tech' as TagKind }),
)

function buildMeta(): ReturnType<typeof parseWorkMeta> | ReturnType<typeof parseAppMeta> {
  if (isApp.value) {
    const num = (value: string) => {
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return {
      version: form.app.version.trim(),
      platforms: form.app.platforms,
      test_types: form.app.test_types,
      test_scope: form.app.test_scope.trim(),
      test_cycle: form.app.test_cycle.trim(),
      env: form.app.env.trim(),
      case_count: num(form.app.case_count),
      bug_total: num(form.app.bug_total),
      bug_p0: num(form.app.bug_p0),
      bug_open: num(form.app.bug_open),
      conclusion: form.app.conclusion.trim(),
      conclusion_level: form.app.conclusion_level,
    }
  }
  return {
    role: form.role.trim(),
    highlights: form.highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    metrics: form.metrics.filter((m) => m.label.trim() && m.value.trim()).map((m) => ({ label: m.label.trim(), value: m.value.trim() })),
    repo_private: form.repo_private,
  }
}

const previewWork = computed<WorkWithTags>(() => ({
  id: id.value || 0,
  kind: kind.value,
  slug: form.slug || 'preview',
  title: form.title || `未命名${isApp.value ? ' App' : '作品'}`,
  subtitle: form.subtitle || null,
  summary: form.summary || null,
  cover_url: form.cover_url || null,
  category: form.category || null,
  status: form.status,
  featured: form.featured ? 1 : 0,
  sort_order: Number.parseInt(form.sort_order, 10) || 0,
  started_at: form.started_at || null,
  finished_at: form.finished_at || null,
  meta: JSON.stringify(buildMeta()),
  created_at: '',
  updated_at: new Date().toISOString(),
  tags: selectedTagObjects.value,
}))

const wordCount = computed(() => form.summary.replace(/\s/g, '').length)

function emptyApp() {
  Object.assign(form.app, {
    version: '',
    platforms: [],
    test_types: [],
    test_scope: '',
    test_cycle: '',
    env: '',
    case_count: '',
    bug_total: '',
    bug_p0: '',
    bug_open: '',
    conclusion: '',
    conclusion_level: 'pass',
  })
}

function resetForm() {
  Object.assign(form, {
    title: '',
    subtitle: '',
    slug: '',
    category: '',
    cover_url: '',
    status: 'done',
    featured: false,
    sort_order: '0',
    started_at: '',
    finished_at: '',
    summary: '',
    tags: [],
    links: [],
    metrics: [],
    role: '',
    highlights: '',
    repo_private: false,
  })
  emptyApp()
  baseline.value = ''
}

function fillFromDetail(detail: NonNullable<Awaited<ReturnType<typeof getWorkById>>>) {
  Object.assign(form, {
    title: detail.title,
    subtitle: detail.subtitle ?? '',
    slug: detail.slug,
    category: detail.category ?? '',
    cover_url: detail.cover_url ?? '',
    status: detail.status,
    featured: detail.featured === 1,
    sort_order: String(detail.sort_order ?? 0),
    started_at: detail.started_at ?? '',
    finished_at: detail.finished_at ?? '',
    summary: detail.summary ?? '',
    tags: detail.tags.map((t) => t.name),
    links: detail.links.map((l) => ({ label: l.label, url: l.url, type: l.type })),
    metrics: [],
    role: '',
    highlights: '',
    repo_private: false,
  })
  emptyApp()
  if (detail.kind === 'app') {
    const meta = parseAppMeta(detail.meta)
    Object.assign(form.app, {
      version: meta.version ?? '',
      platforms: meta.platforms,
      test_types: meta.test_types,
      test_scope: meta.test_scope ?? '',
      test_cycle: meta.test_cycle ?? '',
      env: meta.env ?? '',
      case_count: meta.case_count ? String(meta.case_count) : '',
      bug_total: meta.bug_total ? String(meta.bug_total) : '',
      bug_p0: meta.bug_p0 ? String(meta.bug_p0) : '',
      bug_open: meta.bug_open ? String(meta.bug_open) : '',
      conclusion: meta.conclusion ?? '',
      conclusion_level: meta.conclusion_level ?? 'pass',
    })
  } else {
    const meta = parseWorkMeta(detail.meta)
    form.role = meta.role ?? ''
    form.highlights = meta.highlights.join('\n')
    form.metrics = meta.metrics.map((m) => ({ label: m.label, value: m.value }))
    form.repo_private = meta.repo_private === true
  }
  originalSlug.value = detail.slug
  baseline.value = snapshot.value
}

async function load() {
  loading.value = true
  errors.value = {}
  slugTouched.value = isEdit.value
  try {
    const [tagList, cats] = await Promise.all([listTags(), listCategories(kind.value)])
    allTags.value = tagList
    categories.value = cats.map((c) => c.category)
    if (isEdit.value) {
      const detail = await getWorkById(id.value)
      if (!detail || detail.kind !== kind.value) {
        toast('内容不存在或类型不匹配', 'error')
        await router.replace(basePath.value)
        return
      }
      fillFromDetail(detail)
      document.title = `${formTitle.value} · ${detail.title}`
    } else {
      resetForm()
      const existing = await listWorks({ kind: kind.value, includeAll: true, limit: 200 })
      form.sort_order = String((existing.length + 1) * 10)
      baseline.value = snapshot.value
      document.title = `${formTitle.value} · 内容后台`
    }
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}

function toggleArray(list: string[], value: string, limit = 99): string[] {
  if (list.includes(value)) return list.filter((item) => item !== value)
  if (list.length >= limit) return list
  return [...list, value]
}

function toggleTag(name: string) {
  if (form.tags.includes(name)) form.tags = form.tags.filter((t) => t !== name)
  else if (form.tags.length < 8) form.tags = [...form.tags, name]
  else toast('最多选 8 个标签', 'info')
}

async function addTag() {
  const name = newTag.value.trim()
  if (!name) return
  try {
    await createTag(name, newTagKind.value)
    allTags.value = await listTags()
    newTag.value = ''
    if (!form.tags.includes(name) && form.tags.length < 8) form.tags = [...form.tags, name]
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

function addLink() {
  if (form.links.length >= 6) {
    toast('最多 6 条外链', 'info')
    return
  }
  form.links.push({ label: LINK_TYPE_LABEL.demo, url: '', type: 'demo' })
}

function removeLink(index: number) {
  form.links.splice(index, 1)
}

function moveLink(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= form.links.length) return
  const temp = form.links[index]
  form.links[index] = form.links[next]
  form.links[next] = temp
}

function onLinkType(index: number) {
  const link = form.links[index]
  const defaults = Object.values(LINK_TYPE_LABEL)
  if (!link.label.trim() || defaults.includes(link.label)) link.label = LINK_TYPE_LABEL[link.type]
}

function addMetric() {
  form.metrics.push({ label: '', value: '' })
}

function onTitleInput(value: string) {
  if (!isEdit.value && !slugTouched.value) {
    const generated = slugify(value)
    if (generated.length >= 2) form.slug = generated
  }
}

function setError(key: string, message: string) {
  if (message) errors.value = { ...errors.value, [key]: message }
  else {
    const next = { ...errors.value }
    delete next[key]
    errors.value = next
  }
}

function validateField(field: string, index = -1) {
  if (field === 'title') {
    const value = form.title.trim()
    setError('title', value.length < 2 || value.length > 60 ? '标题需 2–60 个字' : '')
  }
  if (field === 'slug') {
    setError('slug', SLUG_PATTERN.test(form.slug) ? '' : 'slug 仅支持小写字母、数字与连字符，2–60 位')
  }
  if (field === 'subtitle') setError('subtitle', form.subtitle.length > 80 ? '副标题不超过 80 字' : '')
  if (field === 'category') setError('category', form.category.length > 20 ? '分类不超过 20 字' : '')
  if (field === 'summary') setError('summary', form.summary.length > 5000 ? '正文不超过 5000 字' : '')
  if (field === 'cover') {
    const url = form.cover_url.trim()
    setError('cover', url && (!safeHttpUrl(url) || !url.startsWith('https://')) ? '封面需以 https:// 开头' : '')
  }
  if (field === 'link' && index >= 0) {
    const link = form.links[index]
    setError(`link-${index}-label`, link.label.trim().length < 2 || link.label.trim().length > 12 ? '名称需 2–12 字' : '')
    setError(`link-${index}-url`, !safeHttpUrl(link.url) ? '请输入 http(s) 外链' : '')
  }
}

function validateNumbers(): boolean {
  const total = Number.parseInt(form.app.bug_total, 10) || 0
  const p0 = Number.parseInt(form.app.bug_p0, 10) || 0
  const open = Number.parseInt(form.app.bug_open, 10) || 0
  let ok = true
  if (p0 > total) {
    setError('app-p0', 'P0 不能大于缺陷总数')
    ok = false
  } else setError('app-p0', '')
  if (open > total) {
    setError('app-open', '未关闭数不能大于缺陷总数')
    ok = false
  } else setError('app-open', '')
  return ok
}

function validate(): boolean {
  errors.value = {}
  validateField('title')
  validateField('slug')
  validateField('subtitle')
  validateField('category')
  validateField('cover')
  validateField('summary')
  form.links.forEach((_, index) => validateField('link', index))
  if (isApp.value) validateNumbers()
  return Object.keys(errors.value).length === 0
}

async function save() {
  if (saving.value) return
  if (!validate()) {
    toast('请先修正标红的字段', 'error')
    return
  }
  saving.value = true
  try {
    const payload: WorkInput = {
      kind: kind.value,
      slug: form.slug.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      summary: form.summary || null,
      cover_url: form.cover_url.trim() || null,
      category: form.category.trim() || null,
      status: form.status,
      featured: form.featured ? 1 : 0,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
      started_at: form.started_at || null,
      finished_at: form.finished_at || null,
      meta: buildMeta() as WorkInput['meta'],
      links: form.links
        .filter((l) => l.label.trim() && l.url.trim())
        .map((l) => ({ label: l.label.trim(), url: l.url.trim(), type: l.type })),
      tags: form.tags,
    }

    if (isEdit.value) {
      await updateWork(id.value, payload, originalSlug.value)
      originalSlug.value = payload.slug
      baseline.value = snapshot.value
      toast('已保存')
    } else {
      const newId = await createWork(payload)
      baseline.value = snapshot.value
      bypassLeave = true
      toast('已创建，继续完善或发布')
      await router.replace(`${basePath.value}/${newId}/edit`)
    }
    await refreshLists()
    await site.reloadSettings()
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

async function refreshLists() {
  try {
    const [tagList, cats] = await Promise.all([listTags(), listCategories(kind.value)])
    allTags.value = tagList
    categories.value = cats.map((c) => c.category)
  } catch {
    /* 忽略刷新失败 */
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    save()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave((to) => {
  if (!dirty.value || bypassLeave) {
    bypassLeave = false
    return true
  }
  leaveTarget.value = to.fullPath
  leaveOpen.value = true
  return false
})

function confirmLeave() {
  bypassLeave = true
  leaveOpen.value = false
  router.push(leaveTarget.value)
}

watch(
  () => route.params.id,
  () => {
    if (route.name === 'admin-work-edit' || route.name === 'admin-app-edit') load()
  },
)

onMounted(() => {
  load()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <RouterLink :to="basePath" class="icon-btn !h-9 !w-9" aria-label="返回列表">
          <ArrowLeft :size="17" />
        </RouterLink>
        <div>
          <p class="eyebrow">{{ isEdit ? 'EDIT' : 'CREATE' }} / {{ isApp ? 'APP' : 'WORK' }}</p>
          <h1 class="mt-1 text-[19px] font-semibold">{{ formTitle }}</h1>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="dirty" class="chip !h-[24px] !text-[10px] text-warn">未保存</span>
        <button type="button" class="btn btn-sm lg:hidden" @click="previewOpen = true">预览</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="saving || loading" @click="save">
          <Save :size="14" /> {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="card space-y-4 p-6">
      <div v-for="i in 6" :key="i" class="skeleton h-10" />
    </div>

    <div v-else class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-5">
        <section class="card p-4 md:p-5">
          <div class="mb-4 flex items-center gap-2">
            <span class="eyebrow">01 / BASIC</span>
            <span class="h-px flex-1 bg-line opacity-60" />
          </div>
          <div class="grid gap-4">
            <div>
              <label for="f-title" class="field-label">标题 <span class="req">*</span></label>
              <input
                id="f-title"
                v-model="form.title"
                class="input"
                :class="errors.title ? 'is-error' : ''"
                maxlength="60"
                placeholder="例如：多端 HLS-P2P 播放器"
                @input="onTitleInput(form.title)"
                @blur="validateField('title')"
              />
              <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label for="f-subtitle" class="field-label">副标题</label>
                <input
                  id="f-subtitle"
                  v-model="form.subtitle"
                  class="input"
                  :class="errors.subtitle ? 'is-error' : ''"
                  maxlength="80"
                  placeholder="一句话说明结果，例如：首屏 1.2s"
                  @blur="validateField('subtitle')"
                />
                <p v-if="errors.subtitle" class="field-error">{{ errors.subtitle }}</p>
              </div>
              <div>
                <label for="f-slug" class="field-label">slug <span class="req">*</span></label>
                <input
                  id="f-slug"
                  v-model="form.slug"
                  class="input num"
                  :class="errors.slug ? 'is-error' : ''"
                  placeholder="hls-p2p-player"
                  @input="slugTouched = true"
                  @blur="validateField('slug')"
                />
                <p v-if="errors.slug" class="field-error">{{ errors.slug }}</p>
                <p v-else class="mt-1 text-[11px] text-dim">英文标题自动生成；中文请手填，只用小写字母、数字、连字符。</p>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label for="f-category" class="field-label">分类</label>
                <input
                  id="f-category"
                  v-model="form.category"
                  class="input"
                  list="category-options"
                  maxlength="20"
                  placeholder="全栈 / 前端 / 测试平台"
                  @blur="validateField('category')"
                />
                <datalist id="category-options">
                  <option v-for="cat in categories" :key="cat" :value="cat" />
                </datalist>
                <p v-if="errors.category" class="field-error">{{ errors.category }}</p>
              </div>
              <div>
                <ImageUploader
                  v-model="form.cover_url"
                  :label="kind === 'app' ? 'App 图标' : '封面'"
                  :hint="kind === 'app' ? '1:1，留空用首字母占位' : '16:10，留空用渐变占位'"
                  :aspect="kind === 'app' ? 'square' : 'video'"
                />
                <p v-if="errors.cover" class="field-error">{{ errors.cover }}</p>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <span class="field-label">状态</span>
                <div class="segmented w-full">
                  <button
                    v-for="status in statuses"
                    :key="status"
                    type="button"
                    class="flex-1"
                    :class="{ 'is-active': form.status === status }"
                    @click="form.status = status"
                  >
                    {{ statusLabel[status] }}
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="f-start" class="field-label">开始</label>
                  <input id="f-start" v-model="form.started_at" type="month" class="input" />
                </div>
                <div>
                  <label for="f-end" class="field-label">完成</label>
                  <input id="f-end" v-model="form.finished_at" type="month" class="input" />
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-line bg-bg px-4 py-3">
              <div>
                <p class="text-[12.5px]">首页精选</p>
                <p class="mt-0.5 text-[11px] text-dim">最多展示 3 条，优先级高于排序。</p>
              </div>
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': form.featured }"
                role="switch"
                :aria-checked="form.featured"
                aria-label="设为精选"
                @click="form.featured = !form.featured"
              />
            </div>

            <div>
              <label for="f-sort" class="field-label">排序权重（越小越前）</label>
              <input id="f-sort" v-model="form.sort_order" type="number" class="input num md:max-w-[160px]" />
            </div>
          </div>
        </section>

        <section v-if="isApp" class="card p-4 md:p-5">
          <div class="mb-4 flex items-center gap-2">
            <span class="eyebrow">02 / TEST DATA</span>
            <span class="h-px flex-1 bg-line opacity-60" />
          </div>
          <div class="grid gap-4">
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <label for="f-version" class="field-label">版本</label>
                <input id="f-version" v-model="form.app.version" class="input num" placeholder="3.8.2" />
              </div>
              <div>
                <label for="f-cycle" class="field-label">测试周期</label>
                <input id="f-cycle" v-model="form.app.test_cycle" class="input" placeholder="2026-08 ~ 2026-11" />
              </div>
              <div>
                <label for="f-env" class="field-label">测试环境</label>
                <input id="f-env" v-model="form.app.env" class="input" placeholder="真机 12 台 + 弱网仪" />
              </div>
            </div>

            <div>
              <span class="field-label">平台</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="platform in platformOptions"
                  :key="platform"
                  type="button"
                  class="chip"
                  :class="{ 'is-active': form.app.platforms.includes(platform) }"
                  @click="form.app.platforms = toggleArray(form.app.platforms, platform)"
                >
                  {{ platform }}
                </button>
              </div>
            </div>

            <div>
              <span class="field-label">测试类型</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="type in testTypeOptions"
                  :key="type"
                  type="button"
                  class="chip"
                  :class="form.app.test_types.includes(type) ? 'is-active' : 'chip-testtype'"
                  @click="form.app.test_types = toggleArray(form.app.test_types, type)"
                >
                  {{ type }}
                </button>
              </div>
            </div>

            <div>
              <label for="f-scope" class="field-label">覆盖范围</label>
              <textarea
                id="f-scope"
                v-model="form.app.test_scope"
                class="textarea !min-h-[80px]"
                placeholder="登录/注册、会员支付、剧集播放…"
              />
            </div>

            <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label for="f-cases" class="field-label">用例数</label>
                <input id="f-cases" v-model="form.app.case_count" type="number" min="0" class="input num" placeholder="480" />
              </div>
              <div>
                <label for="f-bugs" class="field-label">缺陷总数</label>
                <input id="f-bugs" v-model="form.app.bug_total" type="number" min="0" class="input num" placeholder="96" />
              </div>
              <div>
                <label for="f-p0" class="field-label">P0 缺陷</label>
                <input id="f-p0" v-model="form.app.bug_p0" type="number" min="0" class="input num" :class="errors['app-p0'] ? 'is-error' : ''" placeholder="7" @blur="validateNumbers" />
                <p v-if="errors['app-p0']" class="field-error">{{ errors['app-p0'] }}</p>
              </div>
              <div>
                <label for="f-open" class="field-label">未关闭</label>
                <input id="f-open" v-model="form.app.bug_open" type="number" min="0" class="input num" :class="errors['app-open'] ? 'is-error' : ''" placeholder="3" @blur="validateNumbers" />
                <p v-if="errors['app-open']" class="field-error">{{ errors['app-open'] }}</p>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label for="f-conclusion" class="field-label">结论</label>
                <input id="f-conclusion" v-model="form.app.conclusion" class="input" placeholder="通过，遗留 3 个 P2 及以下问题" />
              </div>
              <div>
                <span class="field-label">结论等级</span>
                <div class="segmented w-full">
                  <button
                    v-for="level in levels"
                    :key="level"
                    type="button"
                    class="flex-1"
                    :class="{ 'is-active': form.app.conclusion_level === level }"
                    @click="form.app.conclusion_level = level"
                  >
                    {{ levelLabel[level] }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-else class="card p-4 md:p-5">
          <div class="mb-4 flex items-center gap-2">
            <span class="eyebrow">02 / ROLE & RESULT</span>
            <span class="h-px flex-1 bg-line opacity-60" />
          </div>
          <div class="grid gap-4">
            <div>
              <label for="f-role" class="field-label">承担角色</label>
              <input id="f-role" v-model="form.role" class="input" placeholder="独立开发 / 前端负责人" />
            </div>
            <div>
              <label for="f-highlights" class="field-label">亮点（一行一条）</label>
              <textarea
                id="f-highlights"
                v-model="form.highlights"
                class="textarea !min-h-[100px]"
                placeholder="起播 3.1s → 1.2s&#10;P2P 节省 62% CDN 流量"
              />
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="field-label !mb-0">量化指标</span>
                <button type="button" class="btn btn-sm" @click="addMetric"><Plus :size="13" /> 加一项</button>
              </div>
              <div v-if="form.metrics.length" class="space-y-2">
                <div v-for="(metric, index) in form.metrics" :key="index" class="flex items-center gap-2">
                  <input v-model="metric.label" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="指标名，如 日活" />
                  <input v-model="metric.value" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="值，如 300+" />
                  <button type="button" class="icon-btn !h-8 !w-8 shrink-0" aria-label="删除指标" @click="form.metrics.splice(index, 1)">
                    <X :size="14" />
                  </button>
                </div>
              </div>
              <p v-else class="text-[11.5px] text-dim">可留空。前台信息卡会以两列展示指标。</p>
            </div>
            <div class="flex items-center justify-between gap-4 rounded-[10px] border border-line bg-bg px-4 py-3">
              <div>
                <p class="text-[12.5px]">代码仓库不公开</p>
                <p class="mt-0.5 text-[11px] text-dim">开启后前台不展示仓库链接。</p>
              </div>
              <button
                type="button"
                class="switch"
                :class="{ 'is-on': form.repo_private }"
                role="switch"
                :aria-checked="form.repo_private"
                aria-label="仓库不公开"
                @click="form.repo_private = !form.repo_private"
              />
            </div>
          </div>
        </section>

        <section class="card p-4 md:p-5">
          <div class="mb-4 flex items-center gap-2">
            <span class="eyebrow">03 / BODY</span>
            <span class="h-px flex-1 bg-line opacity-60" />
            <span class="num text-[10px] text-dim">{{ wordCount }} 字</span>
          </div>
          <div class="mb-3 flex items-center justify-between">
            <div class="segmented">
              <button type="button" :class="{ 'is-active': mode === 'edit' }" @click="mode = 'edit'">编辑</button>
              <button type="button" :class="{ 'is-active': mode === 'preview' }" @click="mode = 'preview'">预览</button>
            </div>
            <span class="text-[10.5px] text-dim">支持 Markdown</span>
          </div>
          <textarea
            v-if="mode === 'edit'"
            v-model="form.summary"
            class="textarea !min-h-[320px] font-mono !text-[13px]"
            placeholder="## 背景&#10;&#10;## 我做了什么&#10;&#10;## 结果"
            @blur="validateField('summary')"
          />
          <div v-else class="min-h-[320px] rounded-[10px] border border-line bg-bg p-4">
            <MarkdownViewer v-if="form.summary" :source="form.summary" />
            <p v-else class="text-[12.5px] text-dim">还没有内容。</p>
          </div>
          <p v-if="errors.summary" class="field-error">{{ errors.summary }}</p>
        </section>

        <section class="card p-4 md:p-5">
          <div class="mb-4 flex items-center gap-2">
            <span class="eyebrow">04 / TAGS</span>
            <span class="h-px flex-1 bg-line opacity-60" />
            <span class="num text-[10px] text-dim">{{ form.tags.length }} / 8</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in allTags"
              :key="tag.id"
              type="button"
              class="chip"
              :class="form.tags.includes(tag.name) ? 'is-active' : `chip-${tag.kind}`"
              @click="toggleTag(tag.name)"
            >
              {{ tag.name }}
            </button>
          </div>
          <div class="mt-4 flex flex-col gap-2 border-t border-line/70 pt-4 sm:flex-row">
            <input v-model="newTag" class="input !h-9 !min-h-0 !text-[12.5px]" placeholder="新建标签（2–12 字）" @keydown.enter.prevent="addTag" />
            <select v-model="newTagKind" class="select !h-9 !min-h-0 !w-auto !text-[12px]">
              <option v-for="(text, value) in TAG_KIND_LABEL" :key="value" :value="value">{{ text }}</option>
            </select>
            <button type="button" class="btn btn-sm shrink-0" @click="addTag"><Plus :size="13" /> 添加</button>
          </div>
        </section>

        <section class="card p-4 md:p-5">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="eyebrow">05 / LINKS</span>
              <span class="h-px w-12 bg-line opacity-60" />
            </div>
            <button type="button" class="btn btn-sm" @click="addLink"><Plus :size="13" /> 添加一条</button>
          </div>
          <div v-if="form.links.length" class="space-y-3">
            <div v-for="(link, index) in form.links" :key="index" class="rounded-[10px] border border-line bg-bg p-3">
              <div class="grid gap-2 md:grid-cols-[120px_1fr_auto]">
                <select v-model="link.type" class="select !h-9 !min-h-0 !text-[12px]" @change="onLinkType(index)">
                  <option v-for="type in linkTypes" :key="type" :value="type">{{ LINK_TYPE_LABEL[type] }}</option>
                </select>
                <input
                  v-model="link.url"
                  class="input !h-9 !min-h-0 !text-[12.5px]"
                  :class="errors[`link-${index}-url`] ? 'is-error' : ''"
                  placeholder="https://…"
                  @blur="validateField('link', index)"
                />
                <div class="flex items-center gap-0.5">
                  <button type="button" class="icon-btn !h-9 !w-9" aria-label="上移" :disabled="index === 0" @click="moveLink(index, -1)">
                    <ArrowUp :size="14" />
                  </button>
                  <button type="button" class="icon-btn !h-9 !w-9" aria-label="下移" :disabled="index === form.links.length - 1" @click="moveLink(index, 1)">
                    <ArrowDown :size="14" />
                  </button>
                  <button type="button" class="icon-btn !h-9 !w-9 hover:!text-danger" aria-label="删除链接" @click="removeLink(index)">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
              <div class="mt-2 grid gap-2 md:grid-cols-[160px_1fr]">
                <input
                  v-model="link.label"
                  class="input !h-9 !min-h-0 !text-[12.5px]"
                  :class="errors[`link-${index}-label`] ? 'is-error' : ''"
                  placeholder="显示名称，如 在线演示"
                  @blur="validateField('link', index)"
                />
                <p class="self-center text-[10.5px] text-dim">
                  <template v-if="errors[`link-${index}-label`] || errors[`link-${index}-url`]">
                    {{ errors[`link-${index}-label`] || errors[`link-${index}-url`] }}
                  </template>
                  <template v-else>顺序即前台展示顺序，最多 6 条。</template>
                </p>
              </div>
            </div>
          </div>
          <p v-else class="text-[11.5px] text-dim">没有外链也可以保存。演示地址、仓库、下载、商店页都建议放这里。</p>
        </section>

        <div class="flex flex-wrap justify-end gap-2 lg:hidden">
          <RouterLink :to="basePath" class="btn">取消</RouterLink>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            <Save :size="15" /> {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>

      <aside class="hidden lg:block">
        <div class="sticky top-20 space-y-4">
          <div class="card p-4">
            <div class="mb-3 flex items-center justify-between">
              <span class="eyebrow">LIVE PREVIEW</span>
              <span class="num text-[10px] text-dim">{{ isApp ? 'APP CARD' : 'WORK CARD' }}</span>
            </div>
            <div class="pointer-events-none">
              <AppCard v-if="isApp" :work="previewWork" />
              <WorkCard v-else :work="previewWork" />
            </div>
            <p class="mt-3 text-[11px] leading-relaxed text-dim">
              预览只反映当前表单内容；标签颜色取决于标签类型。
            </p>
          </div>
          <div class="card p-4 text-[11.5px] leading-relaxed text-dim">
            <p class="eyebrow mb-2">SHORTCUTS</p>
            <p><span class="num rounded bg-surface2 px-1">⌘/Ctrl + S</span> 保存</p>
            <p class="mt-1"><span class="num rounded bg-surface2 px-1">Esc</span> 关闭弹层</p>
            <p class="mt-2 border-t border-line/70 pt-2">
              保存后前台即时可见（同一数据源）；线上 GitHub Pages 需重新构建。
            </p>
          </div>
        </div>
      </aside>
    </div>

    <BaseModal :open="previewOpen" title="卡片预览" wide @close="previewOpen = false">
      <div class="pointer-events-none">
        <AppCard v-if="isApp" :work="previewWork" />
        <WorkCard v-else :work="previewWork" />
      </div>
    </BaseModal>

    <BaseModal :open="leaveOpen" title="有未保存的改动" @close="leaveOpen = false">
      <p class="text-[13px] leading-relaxed">离开后，当前表单里未保存的内容会丢失。</p>
      <p class="mt-2 text-[12px] text-dim">{{ form.title || `未命名${isApp ? ' App' : '作品'}` }} · {{ form.slug || '未填 slug' }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="leaveOpen = false">继续编辑</button>
        <button type="button" class="btn btn-sm btn-danger" @click="confirmLeave">放弃并离开</button>
      </div>
    </BaseModal>
  </div>
</template>
