import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import schemaSql from './schema.sql?raw'
import { idbGet, idbSet } from './idb'
import { seedDatabase } from './seed'
import type { DbAdapter } from './types'

const STORAGE_KEY = 'zf.site.db'
const SNAPSHOT_VERSION_KEY = 'zf.snapshotVersion'

/** 首次访问时优先读取发布快照；没有快照才建库并写入种子数据 */
async function tryFetchSnapshot(SQL: SqlJsStatic): Promise<Database | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const res = await fetch(`${base}/data/site.db`, { cache: 'no-cache', signal: controller.signal })
    if (!res.ok) return null
    const buffer = new Uint8Array(await res.arrayBuffer())
    if (buffer.byteLength < 1024) return null
    const db = new SQL.Database(buffer)
    const check = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='works'")
    if (!check.length || !check[0].values.length) {
      db.close()
      return null
    }
    return db
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSnapshotVersion(): Promise<number | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const res = await fetch(`${base}/data/site-version.json`, { cache: 'no-cache', signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: number }
    return typeof data.version === 'number' && Number.isFinite(data.version) ? data.version : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function readAppliedVersion(): number {
  try {
    return Number(localStorage.getItem(SNAPSHOT_VERSION_KEY) || 0) || 0
  } catch {
    return 0
  }
}

function markAppliedVersion(version: number) {
  try {
    localStorage.setItem(SNAPSHOT_VERSION_KEY, String(version))
  } catch {
    /* ignore */
  }
}

function isAdminBrowser(): boolean {
  try {
    return localStorage.getItem('zf.admin.auth') === '1'
  } catch {
    return false
  }
}

export class LocalAdapter implements DbAdapter {
  readonly mode = 'local' as const
  private db: Database | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private savePromise: Promise<void> | null = null

  async init(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl })
    const saved = await idbGet<Uint8Array>(STORAGE_KEY)
    const admin = isAdminBrowser()

    if (saved && saved.byteLength > 0) {
      try {
        this.db = new SQL.Database(saved)
      } catch {
        this.db = new SQL.Database()
      }

      // 普通访客：发布快照更新后自动刷新本地缓存；后台浏览器保留未发布改动
      if (!admin) {
        const version = await fetchSnapshotVersion()
        if (version && version > readAppliedVersion()) {
          const snapshot = await tryFetchSnapshot(SQL)
          if (snapshot) {
            this.db?.close()
            this.db = snapshot
            markAppliedVersion(version)
          }
        }
      }
    } else {
      const snapshot = await tryFetchSnapshot(SQL)
      if (snapshot) {
        this.db = snapshot
        const version = await fetchSnapshotVersion()
        if (version) markAppliedVersion(version)
      } else {
        this.db = new SQL.Database()
      }
    }

    this.db.run('PRAGMA foreign_keys = ON')
    if (!this.hasTable('works')) {
      this.db.run(schemaSql)
      await seedDatabase(this)
    }
    await this.persistNow()
  }

  private hasTable(name: string): boolean {
    const rows = this.db?.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`)
    return !!rows && rows.length > 0 && rows[0].values.length > 0
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const database = this.db
    if (!database) return Promise.resolve([])
    const stmt = database.prepare(sql)
    try {
      if (params.length) stmt.bind(params as never[])
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T)
      return Promise.resolve(rows)
    } finally {
      stmt.free()
    }
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params)
    return rows[0] ?? null
  }

  run(sql: string, params: unknown[] = []): Promise<void> {
    const database = this.db
    if (!database) return Promise.resolve()
    database.run(sql, params as never[])
    this.schedulePersist()
    return Promise.resolve()
  }

  private schedulePersist() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      void this.persistNow()
    }, 320)
  }

  private persistNow(): Promise<void> {
    if (!this.db) return Promise.resolve()
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const binary = this.db.export()
    this.savePromise = idbSet(STORAGE_KEY, binary).catch(() => undefined)
    return this.savePromise
  }

  async exportBinary(): Promise<Uint8Array> {
    if (this.saveTimer) await this.persistNow()
    if (!this.db) throw new Error('数据库未初始化')
    return this.db.export()
  }

  async loadBinary(bytes: Uint8Array): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl })
    const next = new SQL.Database(bytes)
    next.run('PRAGMA foreign_keys = ON')
    const check = next.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='works'`)
    if (!check.length || !check[0].values.length) {
      next.close()
      throw new Error('文件里没有 works 表，可能不是本站导出的数据库')
    }
    this.db?.close()
    this.db = next
    await this.persistNow()
  }
}
