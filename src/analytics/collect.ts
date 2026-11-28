import dayjs from 'dayjs'
import { db, dbMode } from '@/db'
import { getAnalyticsSettings } from '@/api/settings'

const SESSION_KEY = 'zf.session'
const NO_TRACK_KEY = 'zf.noTrack'
const VISITOR_PREFIX = 'zf.visitor.'
const RECENT_KEY = 'zf.recentPv'

let settingsCache: { at: number; value: Awaited<ReturnType<typeof getAnalyticsSettings>> } | null = null

/** 统计设置缓存 1 分钟，避免每次事件都查一次库 */
async function analyticsSettings() {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value
  const value = await getAnalyticsSettings()
  settingsCache = { at: Date.now(), value }
  return value
}

function isAdminBrowser(): boolean {
  try {
    return localStorage.getItem('zf.admin.auth') === '1'
  } catch {
    return false
  }
}

export type TrackEvent = 'pageview' | 'outbound' | 'resume' | 'search'

export function markNoTrack(): void {
  try {
    localStorage.setItem(NO_TRACK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearNoTrack(): void {
  try {
    localStorage.removeItem(NO_TRACK_KEY)
  } catch {
    /* ignore */
  }
}

export function isNoTrack(): boolean {
  try {
    return localStorage.getItem(NO_TRACK_KEY) === '1'
  } catch {
    return false
  }
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function getSession(): string {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; at: number }
      if (Date.now() - parsed.at < 30 * 60 * 1000) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, at: Date.now() }))
        return parsed.id
      }
    }
    const id = randomId('s_')
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: Date.now() }))
    return id
  } catch {
    return randomId('s_')
  }
}

function getVisitorId(date: string): string {
  try {
    const key = VISITOR_PREFIX + date
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = randomId('v_')
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(VISITOR_PREFIX) && k !== key) localStorage.removeItem(k)
    }
    localStorage.setItem(key, id)
    return id
  } catch {
    return randomId('v_')
  }
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectOs(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Other'
}

function detectBrowser(): string {
  const ua = navigator.userAgent
  if (/MicroMessenger/i.test(ua)) return 'WeChat'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Other'
}

function isBot(): boolean {
  return /bot|crawler|spider|headless|preview|lighthouse/i.test(navigator.userAgent)
}

export function routeTypeOf(path: string): string {
  if (path === '/' || path === '') return 'home'
  if (path === '/works') return 'works'
  if (path.startsWith('/works/')) return 'work'
  if (path === '/apps') return 'apps'
  if (path.startsWith('/apps/')) return 'app'
  if (path === '/about') return 'about'
  return 'other'
}

export function normalizePath(path: string): string {
  const clean = path.split('?')[0].split('#')[0]
  return clean === '' ? '/' : clean
}

function alreadyReported(path: string): boolean {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const last = map[path] ?? 0
    if (Date.now() - last < 5000) return true
    map[path] = Date.now()
    localStorage.setItem(RECENT_KEY, JSON.stringify(map))
    return false
  } catch {
    return false
  }
}

async function insertVisit(input: {
  event: TrackEvent
  path: string
  session_id: string
  visitor_id: string
  meta: Record<string, unknown>
  ref_host: string | null
}) {
  const now = dayjs()
  const date = now.format('YYYY-MM-DD')
  await db().run(
    `INSERT INTO visits
      (ts, date, path, route_type, ref_host, country, device, os, browser, session_id, visitor_id, is_bot, event, meta)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      now.toISOString(),
      date,
      input.path,
      routeTypeOf(input.path),
      input.ref_host,
      null,
      detectDevice(),
      detectOs(),
      detectBrowser(),
      input.session_id,
      input.visitor_id,
      isBot() ? 1 : 0,
      input.event,
      JSON.stringify(input.meta),
    ],
  )
  await db().run(
    `INSERT INTO stats_daily (date, pv, uv, sessions, outbound)
     SELECT date,
       SUM(CASE WHEN event = 'pageview' AND is_bot = 0 THEN 1 ELSE 0 END),
       COUNT(DISTINCT CASE WHEN event = 'pageview' AND is_bot = 0 THEN visitor_id END),
       COUNT(DISTINCT session_id),
       SUM(CASE WHEN event = 'outbound' THEN 1 ELSE 0 END)
     FROM visits WHERE date = ?
     GROUP BY date
     ON CONFLICT(date) DO UPDATE SET
       pv = excluded.pv, uv = excluded.uv, sessions = excluded.sessions, outbound = excluded.outbound`,
    [date],
  )
}

export async function track(
  event: TrackEvent,
  path: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const search = new URLSearchParams(window.location.search)
    if (search.get('no_track') === '1') {
      markNoTrack()
      return
    }
    if (isNoTrack()) return

    const settings = await analyticsSettings()
    if (!settings.enabled) return
    if (settings.respectDnt && navigator.doNotTrack === '1') return
    const rate = Math.min(1, Math.max(0, settings.sampleRate ?? 1))
    if (rate < 1 && Math.random() > rate) return

    const cleanPath = normalizePath(path)
    if (event === 'pageview' && alreadyReported(cleanPath)) return
    if (cleanPath.startsWith('/admin')) return

    const date = dayjs().format('YYYY-MM-DD')
    const payload = {
      v: 1,
      t: event,
      p: cleanPath,
      r: document.referrer || '',
      s: getSession(),
      d: detectDevice(),
      m: meta,
    }

    const endpoint = settings.endpoint || import.meta.env.VITE_ANALYTICS_ENDPOINT || ''
    if (endpoint) {
      const body = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, body)
      } else {
        await fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => undefined)
      }
      return
    }

    const refHost = (() => {
      try {
        if (!payload.r) return null
        const url = new URL(payload.r)
        return url.host === location.host ? null : url.host
      } catch {
        return null
      }
    })()

    // 本地模式且不是后台浏览器：数据只属于当前访客，没有汇总价值，
    // 不写入 IndexedDB，避免每次浏览都导出整库造成卡顿。
    if (dbMode.value === 'local' && !isAdminBrowser()) return

    await insertVisit({
      event,
      path: cleanPath,
      session_id: payload.s,
      visitor_id: getVisitorId(date),
      meta,
      ref_host: refHost,
    })
  } catch {
    // 统计失败绝不影响前台
  }
}

export async function trackOutbound(slug: string, url: string): Promise<void> {
  let host = ''
  try {
    host = new URL(url).host
  } catch {
    host = ''
  }
  await track('outbound', `/works/${slug}`, { slug, url_host: host })
}

export async function trackResume(path = '/'): Promise<void> {
  await track('resume', path, {})
}

export async function trackSearch(keyword: string, results: number): Promise<void> {
  const data = new TextEncoder().encode(keyword.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hash = Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  await track('search', '/works', { keyword_hash: hash, results })
}
