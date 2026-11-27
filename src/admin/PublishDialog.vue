<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  Rocket,
  ShieldCheck,
} from 'lucide-vue-next'
import { exportDatabase, dbMode } from '@/db'
import { saveRawSetting } from '@/api/settings'
import { readBrowserToken, saveBrowserToken, clearBrowserToken, getLatestRun, getPublishConfig, runPreflight, triggerPublish, type PublishCheck, type PublishRun } from '@/api/publish'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import { markPublishedLocally, publishedRevision } from '@/composables/usePublish'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; published: [] }>()

const site = useSiteStore()
const { toast } = useToast()
const cfg = ref(getPublishConfig())
const tokenDraft = ref('')
const savingToken = ref(false)
const usingBrowserToken = ref(!!readBrowserToken())

const checks = ref<PublishCheck[]>([])
const checking = ref(false)
const publishing = ref(false)
const triggered = ref(false)
const run = ref<PublishRun | null>(null)
const error = ref('')
const lastRunLoading = ref(false)

let timer: ReturnType<typeof setInterval> | null = null
let attempts = 0
let triggerAt = 0

const pending = computed(() => Math.max(0, (site.settings.contentRevision || 0) - publishedRevision.value))
const errorCount = computed(() => checks.value.filter((c) => c.level === 'error').length)
const warnCount = computed(() => checks.value.filter((c) => c.level === 'warn').length)
const visibleChecks = computed(() => checks.value.filter((c) => c.level !== 'ok'))
const localMode = computed(() => dbMode.value === 'local')
const canPublish = computed(
  () => cfg.value.configured && !localMode.value && !checking.value && !publishing.value && errorCount.value === 0,
)

const statusText = computed(() => {
  if (publishing.value) return '正在触发发布…'
  if (!run.value) return '尚未获取到运行记录'
  const map: Record<string, string> = {
    queued: '已排队',
    in_progress: '正在构建',
    completed: run.value.conclusion === 'success' ? '发布成功' : '发布失败',
    waiting: '等待中',
    requested: '已触发',
    pending: '等待中',
  }
  return map[run.value.status] || run.value.status
})

const statusTone = computed(() => {
  if (!run.value) return 'text-dim'
  if (run.value.status === 'completed') return run.value.conclusion === 'success' ? 'text-success' : 'text-danger'
  return 'text-warn'
})

function clearTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

async function loadChecks() {
  checking.value = true
  try {
    checks.value = await runPreflight()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    checking.value = false
  }
}

async function loadLatest() {
  if (!cfg.value.configured) return
  lastRunLoading.value = true
  try {
    run.value = await getLatestRun()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    lastRunLoading.value = false
  }
}

async function poll() {
  attempts += 1
  try {
    const latest = await getLatestRun()
    if (latest) {
      run.value = latest
      const createdAt = new Date(latest.createdAt).getTime()
      if (createdAt >= triggerAt - 60_000 && latest.status === 'completed') {
        publishing.value = false
        clearTimer()
        if (latest.conclusion === 'success') {
          await finishSuccess()
        } else {
          toast('发布失败，请查看 Actions 日志', 'error')
        }
        return
      }
      if (createdAt >= triggerAt - 60_000 && latest.status !== 'completed') {
        publishing.value = true
      }
    }
  } catch (err) {
    error.value = (err as Error).message
  }
  if (attempts >= 25) {
    publishing.value = false
    clearTimer()
    toast('发布已触发，请到 Actions 页面查看进度', 'info')
  }
}

async function finishSuccess() {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  try {
    await saveRawSetting('lastPublishedAt', stamp)
    await saveRawSetting('publishedRevision', site.settings.contentRevision || 0)
    markPublishedLocally(site.settings.contentRevision || 0)
    await site.reloadSettings()
  } catch {
    /* 记录时间失败不影响发布结果 */
  }
  emit('published')
  toast('发布成功，线上快照已更新')
}

function saveToken() {
  const clean = tokenDraft.value.trim()
  if (!clean) {
    error.value = '请先粘贴 GitHub Token'
    return
  }
  savingToken.value = true
  try {
    saveBrowserToken(clean)
    cfg.value = getPublishConfig()
    usingBrowserToken.value = true
    tokenDraft.value = ''
    error.value = ''
    window.dispatchEvent(new Event('zf:publish-config'))
    toast('Token 已保存在本机浏览器', 'info')
    void loadChecks()
    void loadLatest()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    savingToken.value = false
  }
}

function forgetToken() {
  clearBrowserToken()
  cfg.value = getPublishConfig()
  usingBrowserToken.value = false
  window.dispatchEvent(new Event('zf:publish-config'))
  toast('已清除本机保存的 Token', 'info')
}

async function publish() {
  if (!canPublish.value) return
  publishing.value = true
  error.value = ''
  triggered.value = true
  attempts = 0
  triggerAt = Date.now()
  try {
    await triggerPublish()
    toast('已触发发布，正在等待构建…', 'info')
    clearTimer()
    timer = setInterval(poll, 6000)
    await poll()
  } catch (err) {
    publishing.value = false
    error.value = (err as Error).message
    clearTimer()
  }
}

async function exportSnapshot() {
  try {
    const bytes = await exportDatabase()
    if (!bytes) {
      toast('云端模式请使用 Turso 控制台备份', 'error')
      return
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/x-sqlite3' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `zf-site-${new Date().toISOString().slice(0, 10)}.db`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    localStorage.setItem('zf.lastExport', new Date().toISOString())
    toast('已导出 .db 快照')
  } catch (err) {
    toast((err as Error).message, 'error')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      error.value = ''
      publishing.value = false
      triggered.value = false
      run.value = null
      void loadChecks()
      void loadLatest()
    } else {
      clearTimer()
    }
  },
)

onBeforeUnmount(clearTimer)
</script>

<template>
  <BaseModal :open="open" title="发布到前台" wide @close="emit('close')">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-bg px-4 py-3">
        <div>
          <p class="text-[13px] font-medium">
            {{ pending ? `有 ${pending} 项改动待发布` : '当前没有未发布的改动' }}
          </p>
          <p class="mt-0.5 text-[11px] text-dim">
            静态站需要重新构建，约 1–3 分钟后生效；访客页面会自动检测并刷新。
          </p>
          <p class="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-dim">
            <span>当前发布通道：{{ cfg.configured ? `${cfg.repo} / ${cfg.branch}` : '未配置' }}</span>
            <button
              v-if="usingBrowserToken"
              type="button"
              class="link-underline text-[10.5px] text-dim hover:text-danger"
              @click="forgetToken"
            >
              清除本机 Token
            </button>
          </p>
        </div>
        <span class="badge" :class="pending ? 'badge-wip' : 'badge-done'">{{ pending ? '待发布' : '已同步' }}</span>
      </div>

      <div>
        <div class="mb-2 flex items-center gap-2">
          <ShieldCheck :size="14" class="text-primary" />
          <span class="text-[12.5px] font-medium">发布前自检</span>
          <span v-if="checking" class="num text-[10px] text-dim">检查中…</span>
          <span v-else class="num text-[10px] text-dim">
            {{ errorCount }} 错误 · {{ warnCount }} 提醒
          </span>
        </div>
        <div v-if="checking" class="skeleton h-24" />
        <div v-else-if="!visibleChecks.length" class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-[11.5px]">
          <CheckCircle2 :size="14" class="shrink-0 text-success" />
          <span>全部自检通过：slug 唯一、外链完整、封面可加载、缺陷数一致。</span>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(item, index) in visibleChecks"
            :key="index"
            class="flex items-start gap-2.5 rounded-lg border px-3 py-2"
            :class="item.level === 'error' ? 'border-danger/35 bg-danger/5' : 'border-warn/35 bg-warn/5'"
          >
            <AlertTriangle :size="13" class="mt-0.5 shrink-0" :class="item.level === 'error' ? 'text-danger' : 'text-warn'" />
            <div class="min-w-0">
              <p class="text-[11.5px] font-medium">{{ item.title }}</p>
              <p class="mt-0.5 break-anywhere text-[11px] leading-relaxed text-dim">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="localMode" class="rounded-[10px] border border-warn/35 bg-warn/5 p-3.5">
        <p class="text-[12px] font-medium text-warn">当前是本地模式</p>
        <p class="mt-1 text-[11.5px] leading-relaxed text-dim">
          发布时服务端会从 Turso 取内容快照；未同步到 Turso 的本地改动不会上线。请先在
          <RouterLink to="/admin/connect" class="text-primary hover:underline" @click="emit('close')">数据源连接</RouterLink>
          中连接 Turso，或先导出 .db 备份。
        </p>
      </div>

      <div v-if="!cfg.configured" class="rounded-[10px] border border-warn/35 bg-warn/5 p-4">
        <div class="flex items-center gap-2">
          <Github :size="14" class="text-warn" />
          <p class="text-[12.5px] font-medium">{{ cfg.repo ? '还差一个 GitHub Token' : '发布通道尚未配置' }}</p>
        </div>

        <template v-if="cfg.repo">
          <p class="mt-1.5 text-[11.5px] leading-relaxed text-dim">
            仓库已配置为 <span class="num text-ink">{{ cfg.repo }}</span
            >。粘贴一个有该仓库 Actions 读写权限的 Fine-grained Token，仅保存在本机浏览器，不会进入构建产物。
          </p>
          <div class="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <input
              v-model="tokenDraft"
              type="password"
              class="input flex-1"
              placeholder="github_pat_..."
              autocomplete="off"
              @keyup.enter="saveToken"
            />
            <button type="button" class="btn btn-primary btn-sm shrink-0" :disabled="savingToken" @click="saveToken">
              保存并启用
            </button>
          </div>
          <p class="mt-2 text-[10.5px] leading-relaxed text-dim">
            GitHub → Settings → Developer settings → Fine-grained tokens：勾选该仓库的 Actions 与 Contents
            读写权限（Contents 用于封面/图片上传）。
          </p>
        </template>

        <template v-else>
          <p class="mt-1.5 text-[11.5px] leading-relaxed text-dim">
            在构建环境写入以下变量后重新构建后台，即可一键触发 GitHub Actions：
          </p>
          <pre class="num mt-2 overflow-x-auto rounded-lg border border-line bg-bg p-3 text-[10.5px] leading-relaxed">VITE_GH_REPO=your-name/your-repo
VITE_GH_TOKEN=github_pat_xxx   # 需要 actions:write
VITE_GH_BRANCH=main
VITE_GH_WORKFLOW=deploy.yml</pre>
          <p class="mt-2 text-[10.5px] leading-relaxed text-dim">
            线上站点推荐把 Token 留空，部署后在发布弹窗里临时填入，避免泄露。
          </p>
        </template>
      </div>

      <div class="rounded-[10px] border border-line bg-bg p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <GitBranch :size="14" class="text-dim" />
            <p class="text-[12px]">最近一次运行</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[12px]" :class="statusTone">{{ statusText }}</span>
            <button v-if="cfg.configured" type="button" class="icon-btn !h-7 !w-7" aria-label="刷新运行状态" :disabled="lastRunLoading" @click="loadLatest">
              <Loader2 :size="12" :class="lastRunLoading ? 'animate-spin' : ''" />
            </button>
          </div>
        </div>
        <div v-if="run" class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-dim">
          <span class="num">{{ run.displayTitle }} · {{ run.createdAt.slice(0, 16).replace('T', ' ') }}</span>
          <a :href="run.htmlUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-primary hover:underline">
            查看日志 <ExternalLink :size="11" />
          </a>
        </div>
        <p v-else-if="cfg.configured" class="mt-2 text-[11px] text-dim">还没有运行记录。</p>
        <p v-else class="mt-2 text-[11px] text-dim">配置后这里会显示排队 / 构建 / 成功 / 失败状态。</p>
      </div>

      <p v-if="error" class="rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-[11.5px] leading-relaxed text-danger" role="alert">
        {{ error }}
      </p>

      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" @click="exportSnapshot"><Download :size="13" /> 导出 .db 快照</button>
          <RouterLink to="/admin/data" class="btn btn-sm" @click="emit('close')">数据管理</RouterLink>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-sm" :disabled="publishing" @click="emit('close')">关闭</button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="!canPublish" @click="publish">
            <Loader2 v-if="publishing" :size="13" class="animate-spin" />
            <Rocket v-else :size="13" />
            {{ publishing ? '发布中…' : triggered ? '重新触发' : '确认发布' }}
          </button>
        </div>
      </div>
      <p v-if="errorCount" class="text-[11px] text-danger">存在 {{ errorCount }} 个错误，修复后才能发布。</p>
      <p v-else-if="localMode" class="text-[11px] text-dim">切换为 Turso 数据源后，这里才能一键发布。</p>
      <p v-else-if="!cfg.configured" class="text-[11px] text-dim">未配置通道时，可先导出 .db 并手动提交部署。</p>
    </div>
  </BaseModal>
</template>
