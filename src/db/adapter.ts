import { ref } from 'vue'
import type { DbAdapter, DbStatement } from './types'
import { LocalAdapter } from './sqljs'
import { TursoAdapter } from './turso'

export type DbMode = 'local' | 'turso'

const TURSO_URL_KEY = 'zf.turso.url'
const TURSO_TOKEN_KEY = 'zf.turso.token'

export const dbMode = ref<DbMode>('local')
export const dbReady = ref(false)
export const dbError = ref('')
export const dbBusy = ref(false)

let current: DbAdapter | null = null
let initPromise: Promise<DbAdapter> | null = null

export function readTursoConfig(): { url: string; token: string } {
  try {
    return {
      url: localStorage.getItem(TURSO_URL_KEY) || '',
      token: localStorage.getItem(TURSO_TOKEN_KEY) || '',
    }
  } catch {
    return { url: '', token: '' }
  }
}

export async function ensureDb(force = false): Promise<DbAdapter> {
  if (force) {
    initPromise = null
    current = null
    dbReady.value = false
    dbError.value = ''
  }
  if (initPromise) return initPromise

  initPromise = (async () => {
    const cfg = readTursoConfig()
    if (cfg.url && cfg.token) {
      try {
        const adapter = new TursoAdapter(cfg.url, cfg.token)
        await adapter.init()
        current = adapter
        dbMode.value = 'turso'
      } catch (error) {
        dbError.value = `云端数据源连接失败：${(error as Error).message}`
        current = null
      }
    }

    if (!current) {
      const local = new LocalAdapter()
      await local.init()
      current = local
      dbMode.value = 'local'
    }

    dbReady.value = true
    return current
  })()

  try {
    return await initPromise
  } catch (error) {
    initPromise = null
    dbReady.value = false
    dbError.value = (error as Error).message
    throw error
  }
}

export async function connectTurso(url: string, token: string): Promise<void> {
  const adapter = new TursoAdapter(url, token)
  await adapter.init()
  localStorage.setItem(TURSO_URL_KEY, url)
  localStorage.setItem(TURSO_TOKEN_KEY, token)
  current = adapter
  dbMode.value = 'turso'
  dbError.value = ''
  dbReady.value = true
  initPromise = Promise.resolve(adapter)
}

export async function disconnectTurso(): Promise<void> {
  localStorage.removeItem(TURSO_URL_KEY)
  localStorage.removeItem(TURSO_TOKEN_KEY)
  current = null
  dbMode.value = 'local'
  await ensureDb(true)
}

export function db(): DbAdapter {
  if (!current) throw new Error('数据源尚未就绪')
  return current
}

/** 合并多次写入：Turso 走 batch，一次 HTTP 往返；本地库逐条执行 */
export async function runBatch(statements: DbStatement[]): Promise<void> {
  if (!statements.length) return
  const adapter = db()
  if (adapter.batch) {
    await adapter.batch(statements)
    return
  }
  for (const statement of statements) await adapter.run(statement.sql, statement.params ?? [])
}

export async function exportDatabase(): Promise<Uint8Array | null> {
  const adapter = db()
  return adapter.exportBinary ? adapter.exportBinary() : null
}

export async function importDatabase(bytes: Uint8Array): Promise<void> {
  const adapter = db()
  if (!adapter.loadBinary) throw new Error('当前数据源（云端）不支持直接导入，请切换到本地模式')
  await adapter.loadBinary(bytes)
  dbBusy.value = false
}
