import { db } from '@/db'
import { parseAppMeta, type Work } from '@/db/types'
import { safeHttpUrl } from '@/lib/utils'

export interface PublishCheck {
  level: 'ok' | 'warn' | 'error'
  title: string
  detail: string
}

export interface PublishConfig {
  repo: string
  token: string
  branch: string
  workflow: string
  configured: boolean
  actionsUrl: string
}

export interface PublishRun {
  status: string
  conclusion: string | null
  htmlUrl: string
  createdAt: string
  displayTitle: string
}

const env = import.meta.env
const TOKEN_KEY = 'zf.publish.token'

/** 部署后的线上后台可以在浏览器里临时保存 Token，避免把 PAT 打进前端产物 */
export function readBrowserToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function saveBrowserToken(token: string): void {
  const clean = token.trim()
  if (!clean) throw new Error('Token 不能为空')
  localStorage.setItem(TOKEN_KEY, clean)
}

export function clearBrowserToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function getPublishConfig(): PublishConfig {
  const repo = String(env.VITE_GH_REPO || '').trim()
  const token = String(env.VITE_GH_TOKEN || '').trim() || readBrowserToken()
  return {
    repo,
    token,
    branch: String(env.VITE_GH_BRANCH || 'main'),
    workflow: String(env.VITE_GH_WORKFLOW || 'deploy.yml'),
    configured: !!repo && !!token,
    actionsUrl: repo ? `https://github.com/${repo}/actions` : '',
  }
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getPublishConfig()
  if (!cfg.configured) throw new Error('发布通道未配置')
  return fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
}

export async function triggerPublish(): Promise<void> {
  const cfg = getPublishConfig()
  if (!cfg.configured) throw new Error('发布通道未配置')
  const res = await github(`/actions/workflows/${encodeURIComponent(cfg.workflow)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: cfg.branch }),
  })
  if (res.status === 204) return
  if (res.status === 404) throw new Error('找不到发布工作流，请检查仓库、分支与 workflow 文件名')
  if (res.status === 401 || res.status === 403) throw new Error('GitHub Token 无效或权限不足（需要 actions:write）')
  throw new Error(`触发发布失败（HTTP ${res.status}）`)
}

export async function getLatestRun(): Promise<PublishRun | null> {
  const cfg = getPublishConfig()
  if (!cfg.configured) return null
  const res = await github(`/actions/runs?branch=${encodeURIComponent(cfg.branch)}&per_page=1`)
  if (!res.ok) throw new Error(`读取发布状态失败（HTTP ${res.status}）`)
  const data = (await res.json()) as {
    workflow_runs?: Array<{
      status: string
      conclusion: string | null
      html_url: string
      created_at: string
      display_title: string
    }>
  }
  const run = data.workflow_runs?.[0]
  if (!run) return null
  return {
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    displayTitle: run.display_title,
  }
}

/** 发布前自检：只检查会导致线上错误的问题 */
export async function runPreflight(): Promise<PublishCheck[]> {
  const database = db()
  const checks: PublishCheck[] = []

  const dup = await database.all<{ slug: string; c: number }>(
    'SELECT slug, COUNT(*) AS c FROM works GROUP BY slug HAVING c > 1',
  )
  checks.push(
    dup.length
      ? { level: 'error', title: 'slug 重复', detail: dup.map((d) => `${d.slug} ×${d.c}`).join('、') }
      : { level: 'ok', title: 'slug 唯一', detail: '没有重复的永久链接。' },
  )

  const links = await database.all<{ work_id: number; label: string; url: string }>(
    'SELECT work_id, label, url FROM work_links',
  )
  const badLinks = links.filter((link) => !safeHttpUrl(link.url) || !link.label.trim())
  checks.push(
    badLinks.length
      ? { level: 'error', title: '外链无效', detail: `${badLinks.length} 条链接缺地址或名称，前台会显示空按钮。` }
      : { level: 'ok', title: '外链完整', detail: `${links.length} 条外链均可点击。` },
  )

  const noCover = await database.all<Work>("SELECT * FROM works WHERE status IN ('done','wip') AND (cover_url IS NULL OR cover_url = '')")
  checks.push(
    noCover.length
      ? { level: 'warn', title: '缺少封面', detail: `${noCover.length} 条公开内容使用渐变占位：${noCover.slice(0, 4).map((w) => w.slug).join('、')}` }
      : { level: 'ok', title: '封面齐全', detail: '公开内容都有封面图。' },
  )

  const published = await database.all<{ slug: string; cover_url: string }>(
    "SELECT slug, cover_url FROM works WHERE status IN ('done','wip') AND cover_url LIKE 'http%' LIMIT 12",
  )
  const broken: string[] = []
  await Promise.all(
    published.map(
      (work) =>
        new Promise<void>((resolve) => {
          const image = new Image()
          const timer = setTimeout(() => {
            image.src = ''
            broken.push(work.slug)
            resolve()
          }, 3000)
          image.onload = () => {
            clearTimeout(timer)
            resolve()
          }
          image.onerror = () => {
            clearTimeout(timer)
            broken.push(work.slug)
            resolve()
          }
          image.src = work.cover_url
        }),
    ),
  )
  checks.push(
    broken.length
      ? { level: 'warn', title: '封面可能 404', detail: `这些封面在浏览器里未能加载：${broken.join('、')}。可能是网络或图床防盗链。` }
      : { level: 'ok', title: '封面可加载', detail: '抽查的封面图都能正常显示。' },
  )

  const apps = await database.all<Work>("SELECT * FROM works WHERE kind = 'app'")
  const badApps = apps.filter((app) => {
    const meta = parseAppMeta(app.meta)
    return meta.bug_p0 > meta.bug_total || meta.bug_open > meta.bug_total
  })
  checks.push(
    badApps.length
      ? { level: 'error', title: '缺陷数关系错误', detail: `P0 或未关闭数大于总数：${badApps.map((a) => a.slug).join('、')}` }
      : { level: 'ok', title: '缺陷数一致', detail: 'P0 / 未关闭均未超过缺陷总数。' },
  )

  const drafts = await database.all<{ c: number }>("SELECT COUNT(*) AS c FROM works WHERE status IN ('draft','archived')")
  const draftCount = drafts[0]?.c ?? 0
  checks.push({
    level: draftCount ? 'warn' : 'ok',
    title: '未公开内容',
    detail: draftCount ? `${draftCount} 条草稿或归档不会出现在线上，确认这是预期。` : '没有草稿或归档内容。',
  })

  return checks
}
