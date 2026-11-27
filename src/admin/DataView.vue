<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Upload,
  Trash2,
} from 'lucide-vue-next'
import { db, dbMode, ensureDb, exportDatabase, importDatabase } from '@/db'
import { seedDatabase } from '@/db/seed'
import { parseAppMeta, type Work } from '@/db/types'
import { purgeOldVisits } from '@/analytics/report'
import { useSiteStore } from '@/stores/site'
import { useToast } from '@/composables/useToast'
import { formatDate, safeHttpUrl } from '@/lib/utils'
import BaseModal from '@/components/BaseModal.vue'

interface CheckItem {
  level: 'ok' | 'warn' | 'error'
  title: string
  detail: string
}

const site = useSiteStore()
const { toast } = useToast()

const busy = ref('')
const lastExport = ref('')
const pendingImport = ref<{ name: string; size: number; bytes: Uint8Array } | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const resetWord = ref('')
const resetOpen = ref(false)
const purgeOpen = ref(false)
const checks = ref<CheckItem[]>([])
const checked = ref(false)
const purgeDays = ref(site.settings.analytics.retentionDays || 180)

const errorCount = computed(() => checks.value.filter((c) => c.level === 'error').length)
const warnCount = computed(() => checks.value.filter((c) => c.level === 'warn').length)
const isLocal = computed(() => dbMode.value === 'local')

function stamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function exportDb() {
  if (busy.value) return
  busy.value = 'export'
  try {
    const bytes = await exportDatabase()
    if (!bytes) {
      toast('云端数据源不支持直接导出 .db，请在 Turso 控制台创建备份', 'error')
      return
    }
    download(`zf-site-${stamp()}.db`, new Blob([bytes], { type: 'application/x-sqlite3' }))
    localStorage.setItem('zf.lastExport', new Date().toISOString())
    lastExport.value = new Date().toISOString()
    toast('已导出完整 .db 备份')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = ''
  }
}

function pickFile() {
  importInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 30 * 1024 * 1024) {
    toast('文件超过 30MB，请确认是本站导出的数据库', 'error')
    return
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  pendingImport.value = { name: file.name, size: file.size, bytes }
}

async function confirmImport() {
  if (!pendingImport.value || busy.value) return
  busy.value = 'import'
  try {
    await importDatabase(pendingImport.value.bytes)
    pendingImport.value = null
    toast('导入成功，正在重新加载…')
    window.setTimeout(() => window.location.reload(), 600)
  } catch (error) {
    toast((error as Error).message, 'error')
    busy.value = ''
  }
}

async function resetSeed() {
  if (resetWord.value !== 'RESET' || busy.value) return
  busy.value = 'reset'
  try {
    const database = db()
    await database.run('DELETE FROM work_links')
    await database.run('DELETE FROM work_tags')
    await database.run('DELETE FROM works')
    await database.run('DELETE FROM tags')
    await database.run('DELETE FROM site_settings')
    await database.run('DELETE FROM admin_audit')
    await database.run('DELETE FROM slug_history')
    await database.run('DELETE FROM visits')
    await database.run('DELETE FROM stats_daily')
    await seedDatabase(database)
    localStorage.removeItem('zf.publishedRevision')
    toast('已重置为种子数据，正在重新加载…')
    window.setTimeout(() => window.location.reload(), 600)
  } catch (error) {
    toast((error as Error).message, 'error')
    busy.value = ''
  }
}

async function runChecks() {
  if (busy.value) return
  busy.value = 'check'
  try {
    const database = db()
    const items: CheckItem[] = []

    const dup = await database.all<{ slug: string; c: number }>(
      'SELECT slug, COUNT(*) AS c FROM works GROUP BY slug HAVING c > 1',
    )
    if (dup.length) items.push({ level: 'error', title: 'slug 重复', detail: dup.map((d) => `${d.slug} ×${d.c}`).join('、') })

    const shortTitles = await database.all<Work>('SELECT * FROM works WHERE length(trim(title)) < 2')
    if (shortTitles.length) items.push({ level: 'error', title: '标题过短', detail: shortTitles.map((w) => w.slug).join('、') })

    const noCover = await database.all<Work>("SELECT * FROM works WHERE cover_url IS NULL OR cover_url = ''")
    if (noCover.length) items.push({ level: 'warn', title: '缺少封面', detail: `${noCover.length} 条内容将使用渐变占位：${noCover.slice(0, 8).map((w) => w.slug).join('、')}` })

    const noSummary = await database.all<Work>("SELECT * FROM works WHERE summary IS NULL OR length(trim(summary)) < 20")
    if (noSummary.length) items.push({ level: 'warn', title: '正文过短或为空', detail: noSummary.slice(0, 8).map((w) => w.slug).join('、') })

    const links = await database.all<{ work_id: number; label: string; url: string }>('SELECT work_id, label, url FROM work_links')
    const badLinks = links.filter((link) => !safeHttpUrl(link.url) || !link.label.trim())
    if (badLinks.length) items.push({ level: 'error', title: '外链地址或名称为空', detail: `共 ${badLinks.length} 条，建议在编辑页补齐` })

    const orphanTags = await database.all<{ name: string }>(
      'SELECT t.name FROM tags t LEFT JOIN work_tags wt ON wt.tag_id = t.id WHERE wt.tag_id IS NULL',
    )
    if (orphanTags.length) items.push({ level: 'warn', title: '孤儿标签', detail: `${orphanTags.length} 个标签没有引用：${orphanTags.slice(0, 10).map((t) => t.name).join('、')}` })

    const apps = await database.all<Work>("SELECT * FROM works WHERE kind = 'app'")
    const badApps = apps.filter((app) => {
      const meta = parseAppMeta(app.meta)
      return meta.bug_p0 > meta.bug_total || meta.bug_open > meta.bug_total
    })
    if (badApps.length) items.push({ level: 'error', title: '缺陷数关系错误', detail: badApps.map((a) => a.slug).join('、') })

    const drafts = await database.all<{ c: number }>("SELECT COUNT(*) AS c FROM works WHERE status IN ('draft','archived')")
    if ((drafts[0]?.c ?? 0) > 0) items.push({ level: 'warn', title: '未公开内容', detail: `${drafts[0]?.c} 条草稿或归档内容不会出现在前台` })

    const empty = await database.all<Work>('SELECT * FROM works')
    if (!empty.length) items.push({ level: 'error', title: '内容为空', detail: '数据库里没有任何作品，建议重置种子数据' })

    if (!items.length) items.push({ level: 'ok', title: '检查通过', detail: '未发现 slug 重复、外链空值或缺陷数关系错误。' })
    checks.value = items
    checked.value = true
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = ''
  }
}

async function confirmPurge() {
  if (busy.value) return
  busy.value = 'purge'
  try {
    const removed = await purgeOldVisits(purgeDays.value)
    toast(removed ? `已清理 ${removed} 条过期访问记录` : '没有超出保留期的数据', 'info')
    purgeOpen.value = false
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = ''
  }
}

async function exportVisits() {
  if (busy.value) return
  busy.value = 'csv'
  try {
    const rows = await db().all<Record<string, unknown>>('SELECT * FROM visits ORDER BY id ASC')
    if (!rows.length) {
      toast('没有可导出的访问数据', 'info')
      return
    }
    const headers = Object.keys(rows[0])
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value)
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\n')
    download(`zf-visits-${stamp()}.csv`, new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    toast(`已导出 ${rows.length} 条访问记录`)
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    busy.value = ''
  }
}

onMounted(async () => {
  document.title = '数据管理 · 内容后台'
  lastExport.value = localStorage.getItem('zf.lastExport') || ''
  try {
    await ensureDb()
  } catch {
    /* 页面自身会提示 */
  }
})
</script>

<template>
  <div class="space-y-5">
    <header>
      <p class="eyebrow">DATA / BACKUP</p>
      <h1 class="mt-2 text-[22px] font-semibold">数据管理</h1>
      <p class="mt-1 text-[12.5px] text-dim">
        当前数据源：{{ isLocal ? '本地 IndexedDB（sql.js）' : 'Turso 云端 SQLite' }}。任何时点都应能导出一份可恢复的 .db。
      </p>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <section class="card p-4 md:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[14px] font-medium">导出数据库</h2>
            <p class="mt-1 text-[11.5px] leading-relaxed text-dim">导出完整 SQLite 二进制，包含内容、链接、标签与配置；可在任意 SQLite 工具打开。</p>
          </div>
          <HardDriveDownload :size="18" class="shrink-0 text-primary" />
        </div>
        <p class="num mt-3 text-[10.5px] text-dim">LAST EXPORT {{ lastExport ? formatDate(lastExport, 'YYYY-MM-DD HH:mm') : '从未导出' }}</p>
        <button type="button" class="btn btn-sm mt-4" :disabled="!!busy || !isLocal" @click="exportDb">
          <Download :size="14" /> {{ busy === 'export' ? '导出中…' : '导出 .db' }}
        </button>
        <p v-if="!isLocal" class="mt-2 text-[11px] text-warn">云端模式请使用 Turso 控制台的备份功能。</p>
      </section>

      <section class="card p-4 md:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[14px] font-medium">导入数据库</h2>
            <p class="mt-1 text-[11.5px] leading-relaxed text-dim">选择本站导出的 .db 覆盖当前数据。导入后页面会自动刷新。</p>
          </div>
          <Upload :size="18" class="shrink-0 text-primary" />
        </div>
        <input ref="importInput" type="file" accept=".db,.sqlite,.sqlite3" class="hidden" @change="onFile" />
        <button type="button" class="btn btn-sm mt-4" :disabled="!!busy || !isLocal" @click="pickFile">
          <Upload :size="14" /> 选择文件
        </button>
        <p v-if="!isLocal" class="mt-2 text-[11px] text-warn">云端模式不支持直接导入，请切换到本地后再试。</p>
      </section>

      <section class="card p-4 md:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[14px] font-medium">重置为种子数据</h2>
            <p class="mt-1 text-[11.5px] leading-relaxed text-dim">清空全部内容、标签、配置与统计，再写入内置示例。不可撤销。</p>
          </div>
          <RefreshCw :size="18" class="shrink-0 text-warn" />
        </div>
        <button type="button" class="btn btn-sm btn-danger mt-4" :disabled="!!busy" @click="resetOpen = true">
          <Trash2 :size="14" /> 重置数据
        </button>
      </section>

      <section class="card p-4 md:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-[14px] font-medium">统计数据</h2>
            <p class="mt-1 text-[11.5px] leading-relaxed text-dim">按保留期清理旧访问记录，或导出 CSV 另存。</p>
          </div>
          <ShieldCheck :size="18" class="shrink-0 text-success" />
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn btn-sm" :disabled="!!busy" @click="purgeOpen = true">清理过期数据</button>
          <button type="button" class="btn btn-sm" :disabled="!!busy" @click="exportVisits">导出访问 CSV</button>
        </div>
      </section>
    </div>

    <section class="card p-4 md:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-[14px] font-medium">完整性自检</h2>
          <p class="mt-1 text-[11.5px] text-dim">检查 slug、封面、正文、外链、标签与缺陷数关系；外链可达性需手动点开确认。</p>
        </div>
        <button type="button" class="btn btn-sm" :disabled="!!busy" @click="runChecks">
          <ShieldCheck :size="14" /> {{ busy === 'check' ? '检查中…' : '运行自检' }}
        </button>
      </div>

      <div v-if="checked" class="mt-4 space-y-2">
        <div class="num flex items-center gap-3 text-[11px] text-dim">
          <span>{{ checks.length }} 项结果</span>
          <span v-if="errorCount" class="text-danger">{{ errorCount }} 个错误</span>
          <span v-if="warnCount" class="text-warn">{{ warnCount }} 个提醒</span>
        </div>
        <div
          v-for="(item, index) in checks"
          :key="index"
          class="flex items-start gap-3 rounded-[10px] border px-4 py-3"
          :class="item.level === 'error' ? 'border-danger/35 bg-danger/5' : item.level === 'warn' ? 'border-warn/35 bg-warn/5' : 'border-success/35 bg-success/5'"
        >
          <AlertTriangle v-if="item.level !== 'ok'" :size="15" class="mt-0.5 shrink-0" :class="item.level === 'error' ? 'text-danger' : 'text-warn'" />
          <CheckCircle2 v-else :size="15" class="mt-0.5 shrink-0 text-success" />
          <div class="min-w-0">
            <p class="text-[12.5px] font-medium">{{ item.title }}</p>
            <p class="mt-0.5 break-anywhere text-[11.5px] leading-relaxed text-dim">{{ item.detail }}</p>
          </div>
        </div>
      </div>
      <p v-else class="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-center text-[12px] text-dim">
        还没有运行检查。建议每次发布前跑一次。
      </p>
    </section>

    <BaseModal :open="!!pendingImport" title="确认导入数据库" @close="pendingImport = null">
      <p class="text-[13px] leading-relaxed">将用「{{ pendingImport?.name }}」覆盖当前全部内容与配置。</p>
      <p class="num mt-2 text-[11.5px] text-dim">{{ ((pendingImport?.size ?? 0) / 1024).toFixed(1) }} KB · 此操作不可撤销</p>
      <p class="mt-3 rounded-lg border border-warn/35 bg-warn/10 px-3 py-2 text-[11.5px] text-warn">建议先导出一份当前 .db 备份。</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="pendingImport = null">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="busy === 'import'" @click="confirmImport">
          {{ busy === 'import' ? '导入中…' : '确认覆盖' }}
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="resetOpen" title="重置为种子数据" @close="resetOpen = false">
      <p class="text-[13px] leading-relaxed">这会删除当前所有作品、App、标签、配置与统计数据，无法恢复。</p>
      <label class="mt-4 block">
        <span class="field-label">输入 <span class="num">RESET</span> 确认</span>
        <input v-model="resetWord" class="input num" placeholder="RESET" @keydown.enter.prevent="resetSeed" />
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="resetOpen = false">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="resetWord !== 'RESET' || busy === 'reset'" @click="resetSeed">
          {{ busy === 'reset' ? '重置中…' : '确认重置' }}
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="purgeOpen" title="清理过期统计" @close="purgeOpen = false">
      <p class="text-[13px] leading-relaxed">删除早于保留期的访问记录与每日汇总，操作会写入审计日志。</p>
      <label class="mt-4 block">
        <span class="field-label">保留天数</span>
        <input v-model.number="purgeDays" type="number" min="7" max="730" class="input num md:max-w-[160px]" />
      </label>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="btn btn-sm" @click="purgeOpen = false">取消</button>
        <button type="button" class="btn btn-sm btn-danger" :disabled="busy === 'purge'" @click="confirmPurge">
          {{ busy === 'purge' ? '清理中…' : '确认清理' }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>
