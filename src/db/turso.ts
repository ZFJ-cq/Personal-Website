import type { Client } from '@libsql/client/web'
import schemaSql from './schema.sql?raw'
import { seedDatabase } from './seed'
import type { DbAdapter, DbStatement } from './types'

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^--/.test(part))
}

export class TursoAdapter implements DbAdapter {
  readonly mode = 'turso' as const
  private client: Client | null = null

  constructor(
    private url: string,
    private token: string,
  ) {}

  async init(): Promise<void> {
    const { createClient } = await import('@libsql/client/web')
    const client = createClient({ url: this.url, authToken: this.token })
    await client.execute('SELECT 1')
    this.client = client
    await client.execute('PRAGMA foreign_keys = ON')

    const check = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='works'",
    )
    if (check.rows.length === 0) {
      for (const statement of splitStatements(schemaSql)) {
        await client.execute(statement)
      }
    }
    // 建表后或空库都补一次种子，seedDatabase 内部按 works 数量幂等判断
    await seedDatabase(this)
  }

  private get ready(): Client {
    if (!this.client) throw new Error('数据源未连接')
    return this.client
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.ready.execute({ sql, args: params as never[] })
    return result.rows as unknown as T[]
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params)
    return rows[0] ?? null
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.ready.execute({ sql, args: params as never[] })
  }

  async batch(statements: DbStatement[]): Promise<void> {
    if (!statements.length) return
    await this.ready.batch(
      statements.map((statement) => ({ sql: statement.sql, args: (statement.params ?? []) as never[] })),
    )
  }
}
