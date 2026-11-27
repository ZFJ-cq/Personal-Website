import { db } from '@/db'
import { bumpContentRevision } from '@/db/revision'
import { defaultSettings, SETTING_KEYS, type SettingKey } from '@/db/defaults'
import type { SiteSettings } from '@/db/types'

export async function getSettings(): Promise<SiteSettings> {
  const fallback = defaultSettings()
  const rows = await db().all<{ key: string; value: string }>('SELECT key, value FROM site_settings')
  const merged: SiteSettings = { ...fallback }

  for (const row of rows) {
    if ((SETTING_KEYS as readonly string[]).includes(row.key)) {
      try {
        merged[row.key as SettingKey] = JSON.parse(row.value)
      } catch {
        // 保留默认值，避免一条脏数据拖垮整站
      }
    }
  }

  const revision = rows.find((r) => r.key === 'contentRevision')
  const published = rows.find((r) => r.key === 'lastPublishedAt')
  merged.contentRevision = revision ? Number(JSON.parse(revision.value)) || 0 : 0
  merged.lastPublishedAt = published ? (JSON.parse(published.value) as string | null) : fallback.lastPublishedAt
  return merged
}

export async function saveSetting<K extends SettingKey>(key: K, value: SiteSettings[K]): Promise<void> {
  await db().run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, JSON.stringify(value)],
  )
  await bumpContentRevision()
}

export async function saveRawSetting(key: string, value: unknown): Promise<void> {
  await db().run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, JSON.stringify(value)],
  )
}

export async function getAnalyticsSettings(): Promise<SiteSettings['analytics']> {
  const row = await db().get<{ value: string }>("SELECT value FROM site_settings WHERE key = 'analytics'")
  const fallback = defaultSettings().analytics
  if (!row) return fallback
  try {
    return { ...fallback, ...JSON.parse(row.value) }
  } catch {
    return fallback
  }
}
