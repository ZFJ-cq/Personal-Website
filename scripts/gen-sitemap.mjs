import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const distDir = resolve(process.cwd(), 'dist')
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const site = (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '')
const base = process.env.VITE_BASE || '/'
const prefix = base.endsWith('/') ? base : `${base}/`
const today = new Date().toISOString().slice(0, 10)

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlOf(path) {
  const relative = path.replace(/^\//, '')
  return `${site}${prefix}${relative}`.replace(/([^:]\/)\/+/g, '$1')
}

const staticPages = [
  { path: '/', priority: '1.0' },
  { path: '/works', priority: '0.9' },
  { path: '/apps', priority: '0.9' },
  { path: '/about', priority: '0.7' },
  { path: '/resume', priority: '0.6' },
]

const entries = [...staticPages]
let works = []

const snapshotPath = resolve(process.cwd(), 'public/data/site.db')
if (existsSync(snapshotPath)) {
  try {
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
    const db = new SQL.Database(new Uint8Array(readFileSync(snapshotPath)))
    const result = db.exec(
      "SELECT kind, slug, featured, finished_at FROM works WHERE status IN ('done','wip') ORDER BY featured DESC, sort_order ASC",
    )
    if (result.length) {
      const { columns, values } = result[0]
      works = values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])))
    }
    db.close()
    console.log(`[gen-sitemap] 从发布快照读取 ${works.length} 条内容`)
  } catch (error) {
    console.warn('[gen-sitemap] 读取快照失败，回退种子数据：', error.message)
  }
}

if (!works.length) {
  try {
    const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'src/db/seed-data.json'), 'utf8'))
    works = (Array.isArray(seed.works) ? seed.works : []).filter(
      (work) => work.slug && work.status !== 'draft' && work.status !== 'archived',
    )
  } catch (error) {
    console.warn('[gen-sitemap] 读取种子数据失败，仅生成静态页面：', error.message)
  }
}

for (const work of works) {
  entries.push({
    path: `/${work.kind === 'app' ? 'apps' : 'works'}/${work.slug}`,
    priority: work.featured ? '0.8' : '0.6',
    lastmod: work.finished_at ? `${work.finished_at}-01` : undefined,
  })
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(urlOf(entry.path))}</loc>
    <lastmod>${entry.lastmod || today}</lastmod>
    <changefreq>${entry.path === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf8')
writeFileSync(
  resolve(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${site}${prefix}sitemap.xml\n`,
  'utf8',
)
console.log(`[gen-sitemap] 已生成 sitemap.xml（${entries.length} 条）与 robots.txt`)
