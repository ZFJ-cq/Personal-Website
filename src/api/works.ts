import { db, runBatch } from '@/db'
import type {
  AppMeta,
  DbStatement,
  Tag,
  Work,
  WorkDetail,
  WorkKind,
  WorkMeta,
  WorkStatus,
  WorkWithTags,
  LinkType,
} from '@/db/types'

const PUBLIC_STATUS = "('done','wip')"

const BUMP_REVISION = `INSERT INTO site_settings (key, value) VALUES ('contentRevision', '1')
  ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`

export interface WorkListOptions {
  kind: WorkKind
  category?: string
  tags?: string[]
  q?: string
  featuredOnly?: boolean
  limit?: number
  offset?: number
  includeAll?: boolean
}

async function attachTags(works: Work[]): Promise<WorkWithTags[]> {
  if (!works.length) return []
  const ids = works.map((w) => w.id)
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db().all<{ work_id: number; id: number; name: string; kind: Tag['kind'] }>(
    `SELECT wt.work_id, t.id, t.name, t.kind
     FROM work_tags wt JOIN tags t ON t.id = wt.tag_id
     WHERE wt.work_id IN (${placeholders})
     ORDER BY t.kind, t.name`,
    ids,
  )
  const map = new Map<number, Tag[]>()
  for (const row of rows) {
    const list = map.get(row.work_id) ?? []
    list.push({ id: row.id, name: row.name, kind: row.kind })
    map.set(row.work_id, list)
  }
  return works.map((w) => ({ ...w, tags: map.get(w.id) ?? [] }))
}

export async function listWorks(options: WorkListOptions): Promise<WorkWithTags[]> {
  const { kind, category, tags, q, featuredOnly, limit = 200, offset = 0, includeAll } = options
  const clauses: string[] = ['kind = ?']
  const params: unknown[] = [kind]

  if (!includeAll) clauses.push(`status IN ${PUBLIC_STATUS}`)
  if (featuredOnly) clauses.push('featured = 1')
  if (category) {
    clauses.push('category = ?')
    params.push(category)
  }
  if (q && q.trim()) {
    const kw = `%${q.trim()}%`
    clauses.push('(title LIKE ? OR subtitle LIKE ? OR summary LIKE ?)')
    params.push(kw, kw, kw)
  }

  const rows = await db().all<Work>(
    `SELECT * FROM works WHERE ${clauses.join(' AND ')}
     ORDER BY featured DESC, sort_order ASC, COALESCE(finished_at, '') DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
  let works = await attachTags(rows)
  if (tags && tags.length) {
    works = works.filter((w) => tags.every((name) => w.tags.some((t) => t.name === name)))
  }
  return works
}

export async function countWorks(kind: WorkKind, includeAll = false): Promise<number> {
  const row = await db().get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM works WHERE kind = ?${includeAll ? '' : ` AND status IN ${PUBLIC_STATUS}`}`,
    [kind],
  )
  return row?.c ?? 0
}

export async function listCategories(kind: WorkKind): Promise<Array<{ category: string; count: number }>> {
  return db().all<{ category: string; count: number }>(
    `SELECT category, COUNT(*) AS count FROM works
     WHERE kind = ? AND status IN ${PUBLIC_STATUS} AND category IS NOT NULL AND category != ''
     GROUP BY category ORDER BY count DESC`,
    [kind],
  )
}

export async function listTags(kind?: WorkKind): Promise<Array<Tag & { count: number }>> {
  if (!kind) {
    return db().all<Tag & { count: number }>(
      `SELECT t.*, COUNT(wt.work_id) AS count FROM tags t
       LEFT JOIN work_tags wt ON wt.tag_id = t.id
       GROUP BY t.id ORDER BY t.kind, t.name COLLATE NOCASE`,
    )
  }
  return db().all<Tag & { count: number }>(
    `SELECT t.*, COUNT(wt.work_id) AS count FROM tags t
     JOIN work_tags wt ON wt.tag_id = t.id
     JOIN works w ON w.id = wt.work_id
     WHERE w.kind = ? AND w.status IN ${PUBLIC_STATUS}
     GROUP BY t.id HAVING count > 0
     ORDER BY t.kind, count DESC, t.name COLLATE NOCASE`,
    [kind],
  )
}

export async function getWorkBySlug(slug: string): Promise<Work | null> {
  return db().get<Work>('SELECT * FROM works WHERE slug = ?', [slug])
}

export async function getSlugRedirect(oldSlug: string): Promise<string | null> {
  const row = await db().get<{ new_slug: string }>('SELECT new_slug FROM slug_history WHERE old_slug = ?', [oldSlug])
  return row?.new_slug ?? null
}

export async function getWorkDetail(slug: string): Promise<WorkDetail | null> {
  const work = await getWorkBySlug(slug)
  if (!work) return null
  const [withTags] = await attachTags([work])
  const links = await db().all<{
    id: number
    work_id: number
    label: string
    url: string
    type: LinkType
    sort_order: number
  }>('SELECT * FROM work_links WHERE work_id = ? ORDER BY sort_order ASC, id ASC', [work.id])
  return { ...withTags, links }
}

export async function getWorkById(id: number): Promise<WorkDetail | null> {
  const work = await db().get<Work>('SELECT * FROM works WHERE id = ?', [id])
  if (!work) return null
  const [withTags] = await attachTags([work])
  const links = await db().all<WorkDetail['links'][number]>(
    'SELECT * FROM work_links WHERE work_id = ? ORDER BY sort_order ASC, id ASC',
    [id],
  )
  return { ...withTags, links }
}

export async function getFeaturedWorks(limit = 3): Promise<WorkWithTags[]> {
  return listWorks({ kind: 'work', featuredOnly: true, limit })
}

export async function getRelatedWorks(work: WorkWithTags, limit = 3): Promise<WorkWithTags[]> {
  const others = await listWorks({ kind: work.kind, limit: 24 })
  const tagNames = new Set(work.tags.map((t) => t.name))
  return others
    .filter((item) => item.id !== work.id)
    .map((item) => {
      const overlap = item.tags.filter((t) => tagNames.has(t.name)).length
      const sameCategory = item.category && item.category === work.category ? 1 : 0
      return { item, score: overlap * 2 + sameCategory }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item)
}

export interface WorkLinkInput {
  label: string
  url: string
  type: LinkType
}

export interface WorkInput {
  kind: WorkKind
  slug: string
  title: string
  subtitle: string | null
  summary: string | null
  cover_url: string | null
  category: string | null
  status: WorkStatus
  featured: number
  sort_order: number
  started_at: string | null
  finished_at: string | null
  meta: WorkMeta | AppMeta
  links: WorkLinkInput[]
  tags: string[]
}

async function assertSlugFree(slug: string, excludeId?: number): Promise<void> {
  const row = await db().get<{ id: number }>(
    `SELECT id FROM works WHERE slug = ?${excludeId ? ' AND id != ?' : ''}`,
    excludeId ? [slug, excludeId] : [slug],
  )
  if (row) throw new Error('slug 已存在，请换一个')
}

async function ensureTag(name: string): Promise<number | null> {
  const clean = name.trim()
  if (!clean) return null
  await db().run('INSERT OR IGNORE INTO tags (name, kind) VALUES (?, ?)', [clean, 'tech'])
  const row = await db().get<{ id: number }>('SELECT id FROM tags WHERE name = ?', [clean])
  return row?.id ?? null
}

async function writeLinks(workId: number, links: WorkLinkInput[]) {
  await db().run('DELETE FROM work_links WHERE work_id = ?', [workId])
  let order = 0
  for (const link of links) {
    await db().run('INSERT INTO work_links (work_id, label, url, type, sort_order) VALUES (?,?,?,?,?)', [
      workId,
      link.label,
      link.url,
      link.type,
      order++,
    ])
  }
}

async function writeTags(workId: number, tags: string[]) {
  await db().run('DELETE FROM work_tags WHERE work_id = ?', [workId])
  for (const name of tags.slice(0, 8)) {
    const tagId = await ensureTag(name)
    if (tagId) await db().run('INSERT OR IGNORE INTO work_tags (work_id, tag_id) VALUES (?,?)', [workId, tagId])
  }
}

async function audit(action: string, targetId: number | null, payload: Record<string, unknown>) {
  await db().run('INSERT INTO admin_audit (action, target_id, payload) VALUES (?,?,?)', [
    action,
    targetId,
    JSON.stringify(payload),
  ])
  await db().run(
    `INSERT INTO site_settings (key, value) VALUES ('contentRevision', '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = datetime('now')`,
  )
}

export async function createWork(input: WorkInput): Promise<number> {
  await assertSlugFree(input.slug)
  await db().run(
    `INSERT INTO works
      (kind, slug, title, subtitle, summary, cover_url, category, status, featured, sort_order, started_at, finished_at, meta, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))`,
    [
      input.kind,
      input.slug,
      input.title,
      input.subtitle,
      input.summary,
      input.cover_url,
      input.category,
      input.status,
      input.featured,
      input.sort_order,
      input.started_at,
      input.finished_at,
      JSON.stringify(input.meta),
    ],
  )
  // Turso 走 HTTP，连接不共享 last_insert_rowid；slug 唯一，按它回查 id
  const row = await db().get<{ id: number }>('SELECT id FROM works WHERE slug = ?', [input.slug])
  const id = row?.id ?? 0
  if (!id) throw new Error('写入失败，未拿到新记录 ID')
  await writeLinks(id, input.links)
  await writeTags(id, input.tags)
  await audit('create_work', id, { kind: input.kind, slug: input.slug, title: input.title })
  return id
}

export async function updateWork(id: number, input: WorkInput, oldSlug: string): Promise<void> {
  await assertSlugFree(input.slug, id)
  if (oldSlug !== input.slug) {
    await db().run('INSERT OR REPLACE INTO slug_history (old_slug, new_slug) VALUES (?, ?)', [oldSlug, input.slug])
  }
  await db().run(
    `UPDATE works SET
      slug=?, title=?, subtitle=?, summary=?, cover_url=?, category=?, status=?, featured=?,
      sort_order=?, started_at=?, finished_at=?, meta=?, updated_at=datetime('now')
     WHERE id=?`,
    [
      input.slug,
      input.title,
      input.subtitle,
      input.summary,
      input.cover_url,
      input.category,
      input.status,
      input.featured,
      input.sort_order,
      input.started_at,
      input.finished_at,
      JSON.stringify(input.meta),
      id,
    ],
  )
  await writeLinks(id, input.links)
  await writeTags(id, input.tags)
  await audit('update_work', id, { slug: input.slug, title: input.title })
}

export async function deleteWork(id: number): Promise<void> {
  const work = await db().get<Work>('SELECT * FROM works WHERE id = ?', [id])
  await db().run('DELETE FROM work_links WHERE work_id = ?', [id])
  await db().run('DELETE FROM work_tags WHERE work_id = ?', [id])
  await db().run('DELETE FROM works WHERE id = ?', [id])
  await audit('delete_work', id, { slug: work?.slug ?? '', title: work?.title ?? '' })
}

export async function duplicateWork(id: number): Promise<number> {
  const detail = await getWorkById(id)
  if (!detail) throw new Error('原作品不存在')
  let slug = `${detail.slug}-copy`
  let index = 2
  while (await getWorkBySlug(slug)) {
    slug = `${detail.slug}-copy-${index++}`
  }
  return createWork({
    kind: detail.kind,
    slug,
    title: `${detail.title}（副本）`,
    subtitle: detail.subtitle,
    summary: detail.summary,
    cover_url: detail.cover_url,
    category: detail.category,
    status: 'draft',
    featured: 0,
    sort_order: detail.sort_order + 1,
    started_at: detail.started_at,
    finished_at: detail.finished_at,
    meta: JSON.parse(detail.meta) as WorkMeta,
    links: detail.links.map((l) => ({ label: l.label, url: l.url, type: l.type })),
    tags: detail.tags.map((t) => t.name),
  })
}

export async function reorderWorks(ids: number[]): Promise<void> {
  if (!ids.length) return
  const statements: DbStatement[] = ids.map((id, index) => ({
    sql: "UPDATE works SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
    params: [index * 10, id],
  }))
  statements.push({ sql: BUMP_REVISION })
  await runBatch(statements)
}

export async function bulkPatch(ids: number[], patch: { featured?: number; status?: WorkStatus }): Promise<void> {
  if (!ids.length) return
  const statements: DbStatement[] = []
  for (const id of ids) {
    if (patch.featured !== undefined) {
      statements.push({
        sql: "UPDATE works SET featured = ?, updated_at = datetime('now') WHERE id = ?",
        params: [patch.featured, id],
      })
    }
    if (patch.status !== undefined) {
      statements.push({
        sql: "UPDATE works SET status = ?, updated_at = datetime('now') WHERE id = ?",
        params: [patch.status, id],
      })
    }
  }
  if (!statements.length) return
  statements.push({ sql: BUMP_REVISION })
  await runBatch(statements)
}

export async function deleteWorks(ids: number[]): Promise<void> {
  if (!ids.length) return
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db().all<Work>(`SELECT * FROM works WHERE id IN (${placeholders})`, ids)
  const statements: DbStatement[] = []
  for (const id of ids) {
    statements.push({ sql: 'DELETE FROM work_links WHERE work_id = ?', params: [id] })
    statements.push({ sql: 'DELETE FROM work_tags WHERE work_id = ?', params: [id] })
    statements.push({ sql: 'DELETE FROM works WHERE id = ?', params: [id] })
  }
  for (const row of rows) {
    statements.push({
      sql: 'INSERT INTO admin_audit (action, target_id, payload) VALUES (?,?,?)',
      params: ['delete_work', row.id, JSON.stringify({ slug: row.slug, title: row.title })],
    })
  }
  statements.push({ sql: BUMP_REVISION })
  await runBatch(statements)
}

export interface SiteStats {
  works: number
  apps: number
  bugs: number
  cases: number
}

export async function getSiteStats(): Promise<SiteStats> {
  const kinds = await db().all<{ kind: WorkKind; c: number }>(
    `SELECT kind, COUNT(*) AS c FROM works WHERE status IN ${PUBLIC_STATUS} GROUP BY kind`,
  )
  const bugRow = await db().get<{ bugs: number }>(
    `SELECT COALESCE(SUM(CAST(json_extract(meta, '$.bug_total') AS INTEGER)), 0) AS bugs
     FROM works WHERE kind = 'app' AND status IN ${PUBLIC_STATUS}`,
  )
  const caseRow = await db().get<{ cases: number }>(
    `SELECT COALESCE(SUM(CAST(json_extract(meta, '$.case_count') AS INTEGER)), 0) AS cases
     FROM works WHERE kind = 'app' AND status IN ${PUBLIC_STATUS}`,
  )
  return {
    works: kinds.find((k) => k.kind === 'work')?.c ?? 0,
    apps: kinds.find((k) => k.kind === 'app')?.c ?? 0,
    bugs: bugRow?.bugs ?? 0,
    cases: caseRow?.cases ?? 0,
  }
}
