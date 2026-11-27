import { ref } from 'vue'
import { db } from '@/db'

const KEY = 'zf.publishedRevision'
const INIT_KEY = 'zf.publishedInit'

function read(): number {
  try {
    return Number(localStorage.getItem(KEY) || 0) || 0
  } catch {
    return 0
  }
}

export const publishedRevision = ref(read())

export function markPublishedLocally(revision: number) {
  publishedRevision.value = revision
  try {
    localStorage.setItem(KEY, String(revision))
  } catch {
    /* ignore */
  }
}

/** 让新设备也能从数据库设置里恢复「上次发布版本」 */
export async function loadPublishedRevision(): Promise<number> {
  try {
    const row = await db().get<{ value: string }>("SELECT value FROM site_settings WHERE key = 'publishedRevision'")
    if (!row?.value) {
      // 首次打开后台且库内没有发布记录：把当前版本当作基线，只初始化一次
      if (!localStorage.getItem(INIT_KEY)) {
        const current = await db().get<{ value: string }>(
          "SELECT value FROM site_settings WHERE key = 'contentRevision'",
        )
        const revision = current?.value ? Number(JSON.parse(current.value)) || 0 : 0
        if (revision > publishedRevision.value) markPublishedLocally(revision)
        localStorage.setItem(INIT_KEY, '1')
      }
      return publishedRevision.value
    }
    const parsed = Number(JSON.parse(row.value))
    if (Number.isFinite(parsed) && parsed > publishedRevision.value) {
      markPublishedLocally(parsed)
    }
  } catch {
    /* 数据库尚未就绪时忽略 */
  }
  return publishedRevision.value
}

export function usePublishState() {
  return { publishedRevision, markPublishedLocally }
}
