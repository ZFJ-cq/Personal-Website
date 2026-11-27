import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const projectRoot = process.cwd()
const output = resolve(projectRoot, 'public/data/site.db')
const versionFile = resolve(projectRoot, 'public/data/site-version.json')

const url = process.env.TURSO_URL || process.env.VITE_TURSO_URL
const token = process.env.TURSO_TOKEN || process.env.VITE_TURSO_TOKEN

if (!url || !token) {
  rmSync(output, { force: true })
  rmSync(versionFile, { force: true })
  console.warn('[snapshot] 未提供 TURSO_URL / TURSO_TOKEN，跳过快照；构建将使用内置种子数据。')
  process.exit(0)
}

const tables = ['tags', 'works', 'work_links', 'work_tags', 'site_settings', 'slug_history']

const client = createClient({ url, authToken: token })
const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })

const db = new SQL.Database()
db.run(readFileSync(resolve(projectRoot, 'src/db/schema.sql'), 'utf8'))

let total = 0
for (const table of tables) {
  const result = await client.execute(`SELECT * FROM ${table}`)
  const columns = result.columns
  if (!columns.length) continue
  const placeholders = columns.map(() => '?').join(',')
  const sql = `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${placeholders})`
  const statement = db.prepare(sql)
  for (const row of result.rows) {
    const params = columns.map((column) => {
      const value = row[column]
      if (typeof value === 'boolean') return value ? 1 : 0
      if (value === undefined) return null
      return value
    })
    statement.run(params)
    total += 1
  }
  statement.free()
  console.log(`[snapshot] ${table}: ${result.rows.length} 行`)
}

const workCount = db.exec('SELECT COUNT(*) FROM works')[0]?.values?.[0]?.[0] ?? 0
if (!Number(workCount)) {
  console.error('[snapshot] 远端 works 表为空，终止发布以避免部署空库。')
  process.exit(1)
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, Buffer.from(db.export()))

const revisionRow = db.exec("SELECT value FROM site_settings WHERE key = 'contentRevision'")
const revision = Number(revisionRow[0]?.values?.[0]?.[0] ?? 0) || 0
const version = Date.now()
writeFileSync(
  versionFile,
  JSON.stringify({ version, revision, generatedAt: new Date().toISOString() }, null, 2),
  'utf8',
)

db.close()
console.log(`[snapshot] 已写入 public/data/site.db（${total} 行，${workCount} 条作品/App，版本 ${version}）`)
