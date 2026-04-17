import { readFileSync } from 'fs'
import { getDefaultDbPath, validateDbPath } from '../utils/platform.js'

let _db: Database | null = null
let _rawDb: any = null // raw handle for closing
let _sql: any = null
let _betterSqlite3: any = null
let _bunSqlite: any = null

export interface Statement<T = Record<string, unknown>> {
  all(params?: unknown[]): T[]
  get(params?: unknown[]): T | undefined
  run(params?: unknown[]): { changes: number }
  iterate(params?: unknown[]): IterableIterator<T>
}

export interface Database {
  prepare<T>(sql: string): Statement<T>
}

// Detect if running in Bun
function isBun(): boolean {
  return typeof Bun !== 'undefined' && Bun.version !== undefined
}

// Try to load database driver in order: Bun > better-sqlite3 > sql.js
async function initDatabase(): Promise<{ type: 'bun' | 'better-sqlite3' | 'sql.js'; module: any }> {
  // Try Bun's built-in SQLite first (fastest, no dependencies)
  if (isBun()) {
    try {
      const { Database } = await import('bun:sqlite')
      _bunSqlite = Database
      return { type: 'bun', module: _bunSqlite }
    } catch {
      // Bun SQLite not available
    }
  }

  // Try better-sqlite3 (native, fast)
  if (!_betterSqlite3) {
    try {
      const betterSqlite3 = await import('better-sqlite3')
      const mod = betterSqlite3.default || betterSqlite3
      // Probe: open an in-memory DB to verify the native binding is functional.
      // This catches cases where the JS package is installed but the compiled
      // .node binary is missing or was built for a different Node.js version
      // (common when better-sqlite3 is an optionalDependency with pnpm on macOS).
      const testDb = new mod(':memory:')
      testDb.close()
      _betterSqlite3 = mod
      return { type: 'better-sqlite3', module: _betterSqlite3 }
    } catch {
      // better-sqlite3 not available or native binding broken — fall through to sql.js
      _betterSqlite3 = null
    }
  } else {
    return { type: 'better-sqlite3', module: _betterSqlite3 }
  }

  // Fall back to sql.js (WASM, universal)
  if (!_sql) {
    const initSqlJs = await import('sql.js')
    _sql = await initSqlJs.default()
  }
  return { type: 'sql.js', module: _sql }
}

function createBunWrapper(Database: any, path: string): Database {
  const db = new Database(path, { readonly: true })
  return {
    prepare<T>(sql: string): Statement<T> {
      const stmt = db.query(sql)
      return {
        all(params: unknown[] = []): T[] {
          return stmt.all(...params) as T[]
        },
        get(params: unknown[] = []): T | undefined {
          return stmt.get(...params) as T | undefined
        },
        run(params: unknown[] = []): { changes: number } {
          const result = stmt.run(...params)
          return { changes: result.changes || 0 }
        },
        *iterate(params: unknown[] = []): IterableIterator<T> {
          for (const row of stmt.iterate(...params)) {
            yield row as T
          }
        },
      }
    },
  }
}

function createBetterSqlite3Wrapper(db: any): Database {
  return {
    prepare<T>(sql: string): Statement<T> {
      const stmt = db.prepare(sql)
      return {
        all(params: unknown[] = []): T[] {
          return stmt.all(...params) as T[]
        },
        get(params: unknown[] = []): T | undefined {
          return stmt.get(...params) as T | undefined
        },
        run(params: unknown[] = []): { changes: number } {
          const result = stmt.run(...params)
          return { changes: result.changes }
        },
        iterate(params: unknown[] = []): IterableIterator<T> {
          return stmt.iterate(...params) as IterableIterator<T>
        },
      }
    },
  }
}

function createSqlJsWrapper(rawDb: any): Database {
  return {
    prepare<T>(sql: string): Statement<T> {
      return {
        all(params: unknown[] = []): T[] {
          const stmt = rawDb.prepare(sql)
          if (params.length > 0) stmt.bind(params)
          const results: T[] = []
          while (stmt.step()) {
            results.push(stmt.getAsObject() as T)
          }
          stmt.free()
          return results
        },
        get(params: unknown[] = []): T | undefined {
          const stmt = rawDb.prepare(sql)
          if (params.length > 0) stmt.bind(params)
          const result = stmt.step() ? (stmt.getAsObject() as T) : undefined
          stmt.free()
          return result
        },
        run(params: unknown[] = []): { changes: number } {
          rawDb.run(sql, params)
          return { changes: rawDb.getRowsModified() }
        },
        *iterate(params: unknown[] = []): IterableIterator<T> {
          const stmt = rawDb.prepare(sql)
          if (params.length > 0) stmt.bind(params)
          try {
            while (stmt.step()) {
              yield stmt.getAsObject() as T
            }
          } finally {
            stmt.free()
          }
        },
      }
    },
  }
}

export function getDb(dbPath?: string): Database {
  if (_db) return _db

  const path = dbPath ?? getDefaultDbPath()
  validateDbPath(path)

  throw new Error('Database not initialized. Call getDbAsync() to initialize.')
}

/**
 * Verifies database is accessible by running a simple test query.
 * Returns true if database is working, false otherwise.
 */
export async function verifyDatabaseAccess(dbPath?: string): Promise<boolean> {
  const path = dbPath ?? getDefaultDbPath()

  try {
    const { type, module } = await initDatabase()
    let testDb: any

    if (type === 'bun') {
      testDb = new module(path, { readonly: true })
    } else if (type === 'better-sqlite3') {
      testDb = new module(path)
    } else {
      // sql.js
      const fileBuffer = readFileSync(path)
      testDb = new module.Database(fileBuffer)
    }

    // Run a simple test query
    const wrapper =
      type === 'bun'
        ? createBunWrapper(module, path)
        : type === 'better-sqlite3'
          ? createBetterSqlite3Wrapper(testDb)
          : createSqlJsWrapper(testDb)

    const result = wrapper.prepare<{ test: number }>('SELECT 1 as test').get()

    // Cleanup
    if (testDb.close) testDb.close()

    return result !== undefined && result !== null && result.test === 1
  } catch {
    return false
  }
}

/**
 * Opens database with retry logic for "database is locked" errors.
 * Retries up to 3 times with exponential backoff (100ms, 500ms, 1000ms).
 */
export async function getDbAsync(dbPath?: string, maxRetries = 3): Promise<Database> {
  if (_db) return _db

  const path = dbPath ?? getDefaultDbPath()
  validateDbPath(path)

  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { type, module } = await initDatabase()

      if (type === 'bun') {
        // Bun: opens file directly, no memory loading, fastest
        const bunDb = new module(path, { readonly: true })
        _rawDb = bunDb
        _db = createBunWrapper(module, path)
      } else if (type === 'better-sqlite3') {
        // better-sqlite3: opens file directly, no memory loading
        const rawDb = new module(path)
        _rawDb = rawDb
        _db = createBetterSqlite3Wrapper(rawDb)
      } else {
        // sql.js: must load entire file into memory
        const fileBuffer = readFileSync(path)
        const rawDb = new module.Database(fileBuffer)
        _rawDb = rawDb
        _db = createSqlJsWrapper(rawDb)
      }

      // Verify the database is working
      const testResult = _db.prepare<{ test: number }>('SELECT 1 as test').get()
      if (testResult === undefined || testResult === null || testResult.test !== 1) {
        throw new Error('Database verification failed')
      }

      return _db
    } catch (error) {
      lastError = error as Error

      // Check if it's a "database is locked" error
      const errorMessage = lastError.message?.toLowerCase() || ''
      const isLockedError =
        errorMessage.includes('database is locked') ||
        errorMessage.includes('busy') ||
        errorMessage.includes('locked')

      if (isLockedError && attempt < maxRetries - 1) {
        // Exponential backoff: 100ms, 500ms, 1000ms
        const delay = [100, 500, 1000][attempt] || 1000
        console.warn(
          `Database locked, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
        )
        await new Promise(resolve => setTimeout(resolve, delay))

        // Reset state for retry
        _db = null
        _rawDb = null
      } else {
        // Not a locked error or last attempt - throw
        break
      }
    }
  }

  throw lastError || new Error('Failed to open database after multiple attempts')
}

export function closeDb(): void {
  if (_db) {
    if (_rawDb?.close) _rawDb.close()
    _db = null
    _rawDb = null
  }
}

// Export which database type is being used (for debugging)
export async function getDbType(): Promise<'bun' | 'better-sqlite3' | 'sql.js'> {
  const { type } = await initDatabase()
  return type
}
