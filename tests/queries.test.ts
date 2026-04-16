import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Database } from './fixtures/create-fixture-db.js'
import { createFixtureDbAsync } from './fixtures/create-fixture-db.js'
import { loadUsageEvents, loadSessions } from '../src/data/queries.js'

let db: Database

beforeAll(async () => {
  db = await createFixtureDbAsync()
})

afterAll(() => {
  db.close()
})

describe('loadUsageEvents', () => {
  it('loads only assistant messages with token data', () => {
    const events = loadUsageEvents(db)
    // All fixture assistant messages have token data; user messages are excluded
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.modelId).toBeTruthy()
      expect(e.providerId).toBeTruthy()
      expect(e.tokens.total).toBeGreaterThan(0)
    }
  })

  it('includes correct token fields', () => {
    const events = loadUsageEvents(db)
    const first = events.find(e => e.messageId === 'msg_001b')
    expect(first).toBeDefined()
    expect(first!.tokens.input).toBe(2000)
    expect(first!.tokens.output).toBe(400)
    expect(first!.tokens.cacheRead).toBe(10000)
    expect(first!.tokens.cacheWrite).toBe(5000)
    expect(first!.tokens.total).toBe(17400) // 2000+400+10000+5000
  })

  it('populates session metadata', () => {
    const events = loadUsageEvents(db)
    const e = events.find(e => e.sessionId === 'ses_001')
    expect(e).toBeDefined()
    expect(e!.sessionTitle).toBe('Fix auth bug')
    expect(e!.sessionDirectory).toBe('/home/user/work/api')
  })

  it('filters by model', () => {
    const events = loadUsageEvents(db, { model: 'gpt-4o' })
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.modelId).toBe('gpt-4o')
    }
  })

  it('filters by provider', () => {
    const events = loadUsageEvents(db, { provider: 'openai' })
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.providerId).toBe('openai')
    }
  })

  it('filters by agent', () => {
    const events = loadUsageEvents(db, { agent: 'plan' })
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.agent).toBe('plan')
    }
  })

  it('filters by date range', () => {
    const to = new Date()
    const from = new Date(Date.now() - 2 * 86_400_000) // last 2 days
    const events = loadUsageEvents(db, { from, to })
    // Only sessions 0, 1, 2 days ago should appear
    for (const e of events) {
      expect(e.timeCreated).toBeGreaterThanOrEqual(from.getTime())
      expect(e.timeCreated).toBeLessThanOrEqual(to.getTime() + 86_400_000)
    }
  })

  it('returns empty array when no events match filters', () => {
    const events = loadUsageEvents(db, { model: 'nonexistent-model-xyz' })
    expect(events).toHaveLength(0)
  })
})

describe('loadSessions', () => {
  it('loads all sessions', () => {
    const sessions = loadSessions(db)
    expect(sessions.length).toBe(7)
  })

  it('has correct fields', () => {
    const sessions = loadSessions(db)
    const s = sessions.find(s => s.id === 'ses_001')
    expect(s).toBeDefined()
    expect(s!.title).toBe('Fix auth bug')
    expect(s!.directory).toBe('/home/user/work/api')
    expect(s!.timeCreated).toBeGreaterThan(0)
    expect(s!.timeUpdated).toBeGreaterThan(s!.timeCreated)
  })
})
