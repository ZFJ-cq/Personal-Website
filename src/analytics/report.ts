import dayjs from 'dayjs'
import { db } from '@/db'
import type { Work } from '@/db/types'

export interface Overview {
  todayPv: number
  todayUv: number
  weekPv: number
  monthUv: number
  sessions: number
  bounceRate: number
}

export interface TrendPoint {
  date: string
  pv: number
  uv: number
}

export interface TopContentRow {
  slug: string
  kind: 'work' | 'app'
  title: string
  pv: number
  uv: number
  outbound: number
  online: boolean
}

export interface Slice {
  label: string
  value: number
  pct: number
}

export interface FunnelStep {
  label: string
  value: number
  rate: number
}

export interface RealtimeRow {
  ts: string
  path: string
  ref_host: string | null
  device: string | null
  browser: string | null
  country: string | null
  event: string
}

export interface EventRow {
  ts: string
  event: string
  path: string
  meta: string
}

const PUBLIC_STATUS = "('done','wip')"

function d(offset: number): string {
  return dayjs().subtract(offset, 'day').format('YYYY-MM-DD')
}

export async function getOverview(): Promise<Overview> {
  const [today, week, month, session, bounce] = await Promise.all([
    db().get<{ pv: number; uv: number }>(
      `SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv FROM visits
       WHERE date = ? AND event = 'pageview' AND is_bot = 0`,
      [d(0)],
    ),
    db().get<{ pv: number }>(
      `SELECT COUNT(*) AS pv FROM visits WHERE date >= ? AND event = 'pageview' AND is_bot = 0`,
      [d(6)],
    ),
    db().get<{ uv: number }>(
      `SELECT COUNT(DISTINCT visitor_id) AS uv FROM visits WHERE date >= ? AND event = 'pageview' AND is_bot = 0`,
      [d(29)],
    ),
    db().get<{ c: number }>(
      `SELECT COUNT(DISTINCT session_id) AS c FROM visits WHERE date >= ? AND event = 'pageview' AND is_bot = 0`,
      [d(6)],
    ),
    db().get<{ total: number; single: number }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN c = 1 THEN 1 ELSE 0 END) AS single FROM (
         SELECT session_id, COUNT(*) AS c FROM visits
         WHERE date >= ? AND event = 'pageview' AND is_bot = 0 GROUP BY session_id
       )`,
      [d(6)],
    ),
  ])
  const total = bounce?.total ?? 0
  return {
    todayPv: today?.pv ?? 0,
    todayUv: today?.uv ?? 0,
    weekPv: week?.pv ?? 0,
    monthUv: month?.uv ?? 0,
    sessions: session?.c ?? 0,
    bounceRate: total > 0 ? Math.round(((bounce?.single ?? 0) / total) * 100) : 0,
  }
}

export async function getTrend(days: number): Promise<TrendPoint[]> {
  const rows = await db().all<{ date: string; pv: number; uv: number }>(
    `SELECT date,
       SUM(CASE WHEN event = 'pageview' AND is_bot = 0 THEN 1 ELSE 0 END) AS pv,
       COUNT(DISTINCT CASE WHEN event = 'pageview' AND is_bot = 0 THEN visitor_id END) AS uv
     FROM visits WHERE date >= ? GROUP BY date ORDER BY date`,
    [d(days - 1)],
  )
  const map = new Map(rows.map((r) => [r.date, r]))
  return Array.from({ length: days }, (_, i) => {
    const date = d(days - 1 - i)
    const row = map.get(date)
    return { date, pv: row?.pv ?? 0, uv: row?.uv ?? 0 }
  })
}

export async function getTopContent(days: number, limit = 10): Promise<TopContentRow[]> {
  const rows = await db().all<{ path: string; pv: number; uv: number; outbound: number }>(
    `SELECT path,
       SUM(CASE WHEN event = 'pageview' AND is_bot = 0 THEN 1 ELSE 0 END) AS pv,
       COUNT(DISTINCT CASE WHEN event = 'pageview' AND is_bot = 0 THEN visitor_id END) AS uv,
       SUM(CASE WHEN event = 'outbound' THEN 1 ELSE 0 END) AS outbound
     FROM visits
     WHERE date >= ? AND (path LIKE '/works/%' OR path LIKE '/apps/%')
     GROUP BY path ORDER BY pv DESC LIMIT ?`,
    [d(days - 1), limit],
  )
  const slugs = rows.map((r) => r.path.replace(/^\/(works|apps)\//, ''))
  const works = slugs.length
    ? await db().all<Work>(`SELECT * FROM works WHERE slug IN (${slugs.map(() => '?').join(',')})`, slugs)
    : []
  const map = new Map(works.map((w) => [w.slug, w]))

  return rows.map((row) => {
    const slug = row.path.replace(/^\/(works|apps)\//, '')
    const work = map.get(slug)
    const online = !!work && PUBLIC_STATUS.includes(work.status)
    return {
      slug,
      kind: row.path.startsWith('/apps/') ? 'app' : 'work',
      title: work?.title ?? '已下线内容',
      pv: row.pv,
      uv: row.uv,
      outbound: row.outbound,
      online,
    }
  })
}

const SEARCH_HOSTS = ['google', 'bing', 'baidu', 'duckduckgo', 'yahoo', 'sogou', 'so.com', 'yandex', 'ecosia']
const SOCIAL_HOSTS = [
  'weixin',
  'wechat',
  'qq.com',
  'weibo',
  'github',
  'twitter',
  'x.com',
  'zhihu',
  'juejin',
  'linkedin',
  'facebook',
  'instagram',
  'douyin',
  't.co',
  'reddit',
]

export async function getSources(days: number): Promise<{ groups: Slice[]; domains: Array<{ host: string; pv: number }> }> {
  const rows = await db().all<{ host: string | null; pv: number }>(
    `SELECT ref_host AS host, COUNT(*) AS pv FROM visits
     WHERE date >= ? AND event = 'pageview' AND is_bot = 0
     GROUP BY ref_host ORDER BY pv DESC`,
    [d(days - 1)],
  )
  let direct = 0
  let search = 0
  let social = 0
  let other = 0
  for (const row of rows) {
    const host = (row.host ?? '').toLowerCase()
    if (!host) direct += row.pv
    else if (SEARCH_HOSTS.some((h) => host.includes(h))) search += row.pv
    else if (SOCIAL_HOSTS.some((h) => host.includes(h))) social += row.pv
    else other += row.pv
  }
  const total = direct + search + social + other
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  return {
    groups: [
      { label: '直接访问', value: direct, pct: pct(direct) },
      { label: '搜索', value: search, pct: pct(search) },
      { label: '社交', value: social, pct: pct(social) },
      { label: '其他', value: other, pct: pct(other) },
    ],
    domains: rows
      .filter((r) => r.host)
      .slice(0, 10)
      .map((r) => ({ host: r.host as string, pv: r.pv })),
  }
}

export async function getDevices(days: number): Promise<Slice[]> {
  const rows = await db().all<{ device: string | null; pv: number }>(
    `SELECT device, COUNT(*) AS pv FROM visits
     WHERE date >= ? AND event = 'pageview' AND is_bot = 0 GROUP BY device ORDER BY pv DESC`,
    [d(days - 1)],
  )
  const total = rows.reduce((sum, r) => sum + r.pv, 0)
  const label: Record<string, string> = { mobile: '移动端', desktop: '桌面端', tablet: '平板' }
  return rows.map((r) => ({
    label: label[r.device ?? ''] ?? '未知',
    value: r.pv,
    pct: total ? Math.round((r.pv / total) * 100) : 0,
  }))
}

export async function getBrowsers(days: number): Promise<Slice[]> {
  const rows = await db().all<{ browser: string | null; pv: number }>(
    `SELECT browser, COUNT(*) AS pv FROM visits
     WHERE date >= ? AND event = 'pageview' AND is_bot = 0 GROUP BY browser ORDER BY pv DESC`,
    [d(days - 1)],
  )
  const total = rows.reduce((sum, r) => sum + r.pv, 0)
  return rows.map((r) => ({
    label: r.browser || '未知',
    value: r.pv,
    pct: total ? Math.round((r.pv / total) * 100) : 0,
  }))
}

export async function getCountries(days: number, limit = 8): Promise<Slice[]> {
  const rows = await db().all<{ country: string | null; pv: number }>(
    `SELECT country, COUNT(*) AS pv FROM visits
     WHERE date >= ? AND event = 'pageview' AND is_bot = 0 GROUP BY country ORDER BY pv DESC LIMIT ?`,
    [d(days - 1), limit],
  )
  const total = rows.reduce((sum, r) => sum + r.pv, 0)
  return rows.map((r) => ({
    label: r.country || '未知',
    value: r.pv,
    pct: total ? Math.round((r.pv / total) * 100) : 0,
  }))
}

export async function getFunnel(days: number): Promise<FunnelStep[]> {
  const row = await db().get<{ home: number; detail: number; outbound: number; resume: number }>(
    `SELECT
      (SELECT COUNT(DISTINCT visitor_id) FROM visits WHERE date >= ? AND path = '/' AND event='pageview' AND is_bot=0) AS home,
      (SELECT COUNT(DISTINCT visitor_id) FROM visits WHERE date >= ? AND (path LIKE '/works/%' OR path LIKE '/apps/%') AND event='pageview' AND is_bot=0) AS detail,
      (SELECT COUNT(DISTINCT session_id) FROM visits WHERE date >= ? AND event='outbound') AS outbound,
      (SELECT COUNT(DISTINCT session_id) FROM visits WHERE date >= ? AND event='resume') AS resume`,
    [d(days - 1), d(days - 1), d(days - 1), d(days - 1)],
  )
  const home = row?.home ?? 0
  const detail = row?.detail ?? 0
  const outbound = row?.outbound ?? 0
  const resume = row?.resume ?? 0
  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
  return [
    { label: '首页', value: home, rate: 100 },
    { label: '作品详情', value: detail, rate: rate(detail, home) },
    { label: '外链点击', value: outbound, rate: rate(outbound, detail) },
    { label: '简历下载', value: resume, rate: rate(resume, home) },
  ]
}

export interface HeatmapData {
  /** 7 行（周一..周日）× 24 列（0..23 时），值为 PV */
  matrix: number[][]
  max: number
  total: number
}

export async function getHourlyActivity(days: number): Promise<HeatmapData> {
  const rows = await db().all<{ ts: string }>(
    `SELECT ts FROM visits
     WHERE date >= ? AND event = 'pageview' AND is_bot = 0
     ORDER BY ts`,
    [d(days - 1)],
  )
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const row of rows) {
    const time = dayjs(row.ts)
    if (!time.isValid()) continue
    const weekday = (time.day() + 6) % 7
    matrix[weekday][time.hour()] += 1
  }
  let max = 0
  let total = 0
  for (const row of matrix) {
    for (const value of row) {
      if (value > max) max = value
      total += value
    }
  }
  return { matrix, max, total }
}

export async function getRealtime(): Promise<{ online: number; rows: RealtimeRow[] }> {
  const cutoff = dayjs().subtract(5, 'minute').toISOString()
  const rows = await db().all<RealtimeRow & { session_id: string }>(
    `SELECT ts, path, ref_host, device, browser, country, event, session_id FROM visits
     WHERE ts >= ? ORDER BY ts DESC LIMIT 20`,
    [cutoff],
  )
  const online = new Set(rows.map((r) => r.session_id)).size
  return { online, rows }
}

export async function getRecentEvents(limit = 12): Promise<EventRow[]> {
  return db().all<EventRow>(
    `SELECT ts, event, path, meta FROM visits WHERE event != 'pageview' ORDER BY ts DESC LIMIT ?`,
    [limit],
  )
}

export async function purgeOldVisits(retentionDays: number): Promise<number> {
  const cutoff = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD')
  const row = await db().get<{ c: number }>('SELECT COUNT(*) AS c FROM visits WHERE date < ?', [cutoff])
  const count = row?.c ?? 0
  if (count > 0) {
    await db().run('DELETE FROM visits WHERE date < ?', [cutoff])
    await db().run('DELETE FROM stats_daily WHERE date < ?', [cutoff])
    await db().run('INSERT INTO admin_audit (action, payload) VALUES (?, ?)', [
      'purge_stats',
      JSON.stringify({ retentionDays, removed: count }),
    ])
  }
  return count
}

export async function rebuildStats(): Promise<void> {
  await db().run(
    `INSERT INTO stats_daily (date, pv, uv, sessions, outbound)
     SELECT date,
       SUM(CASE WHEN event = 'pageview' AND is_bot = 0 THEN 1 ELSE 0 END),
       COUNT(DISTINCT CASE WHEN event = 'pageview' AND is_bot = 0 THEN visitor_id END),
       COUNT(DISTINCT session_id),
       SUM(CASE WHEN event = 'outbound' THEN 1 ELSE 0 END)
     FROM visits GROUP BY date
     ON CONFLICT(date) DO UPDATE SET
       pv = excluded.pv, uv = excluded.uv, sessions = excluded.sessions, outbound = excluded.outbound`,
  )
}

const DEVICES = ['mobile', 'desktop', 'mobile', 'mobile', 'desktop', 'tablet'] as const
const BROWSERS = ['Chrome', 'Safari', 'Chrome', 'WeChat', 'Edge', 'Firefox'] as const
const OS_LIST = ['iOS', 'Android', 'macOS', 'Windows', 'Linux'] as const
const REFS = [null, null, null, 'www.google.com', 'www.baidu.com', 'github.com', 'weixin.qq.com', 'juejin.cn'] as const
const COUNTRIES = [null, null, 'CN', 'CN', 'CN', 'US', 'SG'] as const

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function rid(prefix: string): string {
  return prefix + Math.random().toString(16).slice(2, 10)
}

export async function generateDemoVisits(days = 30): Promise<number> {
  const works = await db().all<Work>(`SELECT * FROM works WHERE status IN ${PUBLIC_STATUS}`)
  const paths = ['/', '/works', '/apps', '/about', ...works.map((w) => `/${w.kind === 'app' ? 'apps' : 'works'}/${w.slug}`)]
  let inserted = 0

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = dayjs().subtract(offset, 'day')
    const date = day.format('YYYY-MM-DD')
    const visitors = 12 + Math.floor(Math.random() * 26)
    const sessions = Array.from({ length: visitors }, () => rid('s_'))
    const sessionCount = 10 + Math.floor(Math.random() * 20)

    for (let i = 0; i < sessionCount; i += 1) {
      const sid = sessions[i % sessions.length]
      const vid = `v_${date.slice(5).replace('-', '')}_${i % visitors}`
      const pageViews = 1 + Math.floor(Math.random() * 4)
      for (let p = 0; p < pageViews; p += 1) {
        const path = p === 0 ? '/' : pick(paths)
        const at = day.hour(9 + Math.floor(Math.random() * 11)).minute(Math.floor(Math.random() * 60))
        await db().run(
          `INSERT INTO visits (ts, date, path, route_type, ref_host, country, device, os, browser, session_id, visitor_id, is_bot, event, meta)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'pageview','{}')`,
          [
            at.toISOString(),
            date,
            path,
            path === '/' ? 'home' : path === '/works' ? 'works' : path === '/apps' ? 'apps' : path === '/about' ? 'about' : path.startsWith('/works/') ? 'work' : 'app',
            pick(REFS),
            pick(COUNTRIES),
            pick(DEVICES),
            pick(OS_LIST),
            pick(BROWSERS),
            sid,
            vid,
          ],
        )
        inserted += 1
      }
      if (Math.random() < 0.32 && works.length) {
        const work = pick(works)
        const slug = work.slug
        await db().run(
          `INSERT INTO visits (ts, date, path, route_type, ref_host, country, device, os, browser, session_id, visitor_id, is_bot, event, meta)
           VALUES (?,?,?,?,?,NULL,?,?,?,?,?,0,'outbound',?)`,
          [
            day.hour(10 + Math.floor(Math.random() * 9)).toISOString(),
            date,
            `/${work.kind === 'app' ? 'apps' : 'works'}/${slug}`,
            work.kind === 'app' ? 'app' : 'work',
            pick(REFS),
            pick(DEVICES),
            pick(OS_LIST),
            pick(BROWSERS),
            sid,
            vid,
            JSON.stringify({ slug, url_host: 'example.com' }),
          ],
        )
        inserted += 1
      }
      if (Math.random() < 0.08) {
        await db().run(
          `INSERT INTO visits (ts, date, path, route_type, ref_host, country, device, os, browser, session_id, visitor_id, is_bot, event, meta)
           VALUES (?,?,?,?,?,NULL,?,?,?,?,?,0,'resume','{}')`,
          [
            day.hour(11).toISOString(),
            date,
            '/',
            'home',
            pick(REFS),
            pick(DEVICES),
            pick(OS_LIST),
            pick(BROWSERS),
            sid,
            vid,
          ],
        )
        inserted += 1
      }
    }
  }
  await rebuildStats()
  return inserted
}
