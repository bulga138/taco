declare module 'sql.js' {
  export default function initSqlJs(config?: unknown): Promise<SqlJsStatic>

  export interface SqlJsStatic {
    Database: typeof Database
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    run(sql: string, params?: unknown[]): void
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    getRowsModified(): number
    close(): void
  }

  export interface Statement {
    bind(params?: unknown[]): boolean
    step(): boolean
    getAsObject(params?: unknown): Record<string, unknown>
    free(): boolean
  }

  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }
}
