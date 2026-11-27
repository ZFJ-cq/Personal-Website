import { db } from './adapter'

/** 内容写操作后累加发布计数，驱动后台「待发布」提示 */
export async function bumpContentRevision(): Promise<void> {
  await db().run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ('contentRevision', '1', datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = datetime('now')`,
  )
}
