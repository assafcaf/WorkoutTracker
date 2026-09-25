// The subset of Cloudflare D1's binding the Worker uses. Declared here rather than pulled from
// @cloudflare/workers-types, so tests can stand in a double without the full type.
export type D1Result<T = unknown> = { results: T[] }

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}
