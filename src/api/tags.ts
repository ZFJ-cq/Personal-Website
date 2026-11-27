import { db } from '@/db'
import { bumpContentRevision } from '@/db/revision'
import type { TagKind } from '@/db/types'

export async function renameTag(id: number, name: string): Promise<void> {
  const clean = name.trim()
  if (clean.length < 2 || clean.length > 12) throw new Error('标签名需 2–12 个字')
  const exists = await db().get<{ id: number }>('SELECT id FROM tags WHERE name = ? AND id != ?', [clean, id])
  if (exists) throw new Error('已存在同名标签，可用「合并」处理')
  await db().run('UPDATE tags SET name = ? WHERE id = ?', [clean, id])
  await bumpContentRevision()
}

export async function setTagKind(id: number, kind: TagKind): Promise<void> {
  await db().run('UPDATE tags SET kind = ? WHERE id = ?', [kind, id])
  await bumpContentRevision()
}

export async function deleteTag(id: number): Promise<void> {
  await db().run('DELETE FROM work_tags WHERE tag_id = ?', [id])
  await db().run('DELETE FROM tags WHERE id = ?', [id])
  await bumpContentRevision()
}

export async function mergeTags(sourceId: number, targetId: number): Promise<void> {
  if (sourceId === targetId) return
  await db().run('INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT work_id, ? FROM work_tags WHERE tag_id = ?', [
    targetId,
    sourceId,
  ])
  await db().run('DELETE FROM work_tags WHERE tag_id = ?', [sourceId])
  await db().run('DELETE FROM tags WHERE id = ?', [sourceId])
  await bumpContentRevision()
}

export async function createTag(name: string, kind: TagKind = 'tech'): Promise<void> {
  const clean = name.trim()
  if (clean.length < 2 || clean.length > 12) throw new Error('标签名需 2–12 个字')
  await db().run('INSERT OR IGNORE INTO tags (name, kind) VALUES (?, ?)', [clean, kind])
  await bumpContentRevision()
}
