import type { DbAdapter } from './types'
import seed from './seed-data.json'
import hlsBody from '@/content/work-hls-player.md?raw'
import caseBody from '@/content/work-case-platform.md?raw'
import cacheBody from '@/content/work-shorts-cache.md?raw'
import mockBody from '@/content/work-api-mock.md?raw'
import appShortplay from '@/content/app-shortplay.md?raw'
import appCrosspay from '@/content/app-crosspay.md?raw'
import appSocial from '@/content/app-social.md?raw'
import appCommunity from '@/content/app-community.md?raw'
import appGujianHotel from '@/content/app-gujian-hotel.md?raw'
import appYuegou from '@/content/app-yuegou-ecommerce.md?raw'

const BODIES: Record<string, string> = {
  'work-hls-player': hlsBody,
  'work-case-platform': caseBody,
  'work-shorts-cache': cacheBody,
  'work-api-mock': mockBody,
  'app-shortplay': appShortplay,
  'app-crosspay': appCrosspay,
  'app-social': appSocial,
  'app-community': appCommunity,
  'app-gujian-hotel': appGujianHotel,
  'app-yuegou-ecommerce': appYuegou,
}

interface SeedWork {
  kind: 'work' | 'app'
  slug: string
  title: string
  subtitle?: string | null
  category?: string
  status: 'draft' | 'wip' | 'done' | 'archived'
  featured: number
  sort_order: number
  started_at?: string
  finished_at?: string | null
  coverPrompt?: string
  iconPrompt?: string
  body?: string
  meta: Record<string, unknown>
  links: { label: string; url: string; type: string }[]
  tags: string[]
}

export function imageUrl(prompt: string, size = 'landscape_16_9'): string {
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`
}

async function seedSettings(database: DbAdapter) {
  const entries = Object.entries(seed.settings)
  for (const [key, value] of entries) {
    await database.run('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ])
  }
}

export async function seedDatabase(database: DbAdapter): Promise<void> {
  await seedSettings(database)

  const row = await database.get<{ c: number }>('SELECT COUNT(*) AS c FROM works')
  if ((row?.c ?? 0) > 0) return

  const tagKinds = seed.tagKinds as Record<string, string>
  for (const [name, kind] of Object.entries(tagKinds)) {
    await database.run('INSERT OR IGNORE INTO tags (name, kind) VALUES (?, ?)', [name, kind])
  }
  const tagRows = await database.all<{ id: number; name: string }>('SELECT id, name FROM tags')
  const tagId = new Map(tagRows.map((t) => [t.name, t.id]))

  const works = seed.works as SeedWork[]
  let order = 0
  for (const work of works) {
    order += 1
    const cover = work.coverPrompt
      ? imageUrl(work.coverPrompt)
      : work.iconPrompt
        ? imageUrl(work.iconPrompt, 'square_hd')
        : null
    await database.run(
      `INSERT INTO works
        (kind, slug, title, subtitle, summary, cover_url, category, status, featured, sort_order, started_at, finished_at, meta, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))`,
      [
        work.kind,
        work.slug,
        work.title,
        work.subtitle ?? null,
        work.body ? (BODIES[work.body] ?? null) : null,
        cover,
        work.category ?? null,
        work.status,
        work.featured,
        work.sort_order ?? order,
        work.started_at ?? null,
        work.finished_at ?? null,
        JSON.stringify(work.meta),
      ],
    )
    // Turso 走 HTTP，连接不共享 last_insert_rowid；slug 唯一，直接按它取回 id
    const created = await database.get<{ id: number }>('SELECT id FROM works WHERE slug = ?', [work.slug])
    const workId = created?.id
    if (!workId) continue

    let linkOrder = 0
    for (const link of work.links) {
      await database.run(
        'INSERT INTO work_links (work_id, label, url, type, sort_order) VALUES (?,?,?,?,?)',
        [workId, link.label, link.url, link.type, linkOrder++],
      )
    }
    for (const tag of work.tags) {
      const tid = tagId.get(tag)
      if (tid) await database.run('INSERT OR IGNORE INTO work_tags (work_id, tag_id) VALUES (?,?)', [workId, tid])
    }
  }

  await database.run('INSERT INTO admin_audit (action, payload) VALUES (?, ?)', [
    'seed',
    JSON.stringify({ works: works.length }),
  ])
}
