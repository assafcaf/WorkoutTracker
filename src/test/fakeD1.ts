// A D1Database stand-in over sql.js (SQLite compiled to wasm), so Worker tests run the real
// schema from migrations/*.sql and the real SQL, without wrangler or the network.
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js'
import type { D1Database, D1PreparedStatement, D1Result } from '../worker/d1'

// src/test/fakeD1.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const migrationsDir = join(repoRoot, 'migrations')

let sqlJs: Promise<SqlJsStatic> | undefined

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    const wasmDir = dirname(createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm'))
    sqlJs = initSqlJs({ locateFile: (file: string) => join(wasmDir, file) })
  }
  return sqlJs
}

function toSqlValue(value: unknown): SqlValue {
  // D1 refuses undefined rather than storing NULL; mirror that so a missing bind is caught here.
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: Type undefined is not supported')
  if (typeof value === 'boolean') return value ? 1 : 0
  return value as SqlValue
}

function execute(db: Database, sql: string, params: SqlValue[]): Record<string, unknown>[] {
  const statement = db.prepare(sql)
  try {
    statement.bind(params)
    const rows: Record<string, unknown>[] = []
    while (statement.step()) rows.push(statement.getAsObject())
    return rows
  } finally {
    statement.free()
  }
}

class FakeStatement implements D1PreparedStatement {
  constructor(
    private readonly db: Database,
    readonly sql: string,
    private readonly params: SqlValue[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new FakeStatement(this.db, this.sql, values.map(toSqlValue))
  }

  async first<T = unknown>(): Promise<T | null> {
    return (this.exec().results[0] as T | undefined) ?? null
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return this.exec() as D1Result<T>
  }

  async run(): Promise<unknown> {
    return this.exec()
  }

  /** Runs the statement now; the shape D1 answers for all() and run(). */
  exec(): D1Result<unknown> & { success: true; meta: { changes: number } } {
    const results = execute(this.db, this.sql, this.params)
    return { results, success: true, meta: { changes: this.db.getRowsModified() } }
  }
}

/** A fresh, empty database with every migrations/*.sql applied in name order. */
export async function createFakeD1(): Promise<D1Database> {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) db.run(readFileSync(join(migrationsDir, file), 'utf-8'))

  return {
    prepare(sql: string) {
      return new FakeStatement(db, sql)
    },
    // D1 runs a batch as one transaction: all of it lands, or none of it does.
    async batch(statements: D1PreparedStatement[]) {
      db.run('BEGIN')
      try {
        const results = statements.map((statement) => (statement as FakeStatement).exec())
        db.run('COMMIT')
        return results
      } catch (error) {
        db.run('ROLLBACK')
        throw error
      }
    },
  }
}
