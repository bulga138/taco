import { describe, it, expect } from 'vitest'
import {
  formatTokens,
  formatCost,
  formatPercent,
  formatInt,
  formatDelta,
  truncate,
} from '../src/utils/formatting.js'
import { parseDate, formatDuration, dateRange } from '../src/utils/dates.js'

// ─── formatting utils ─────────────────────────────────────────────────────────

describe('formatTokens', () => {
  it('formats millions with M suffix', () => {
    expect(formatTokens(1_234_567)).toBe('1.2M')
    expect(formatTokens(2_000_000)).toBe('2.0M')
  })

  it('formats thousands with k suffix', () => {
    expect(formatTokens(98_000)).toBe('98.0k')
    expect(formatTokens(1_500)).toBe('1.5k')
  })

  it('formats small numbers without suffix', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(0)).toBe('0')
  })
})

describe('formatCost', () => {
  it('formats dollars with 2 decimal places', () => {
    expect(formatCost(14.37)).toBe('$14.37')
    expect(formatCost(0.5)).toBe('$0.50')
  })

  it('formats sub-cent costs with 4 decimal places', () => {
    expect(formatCost(0.004)).toBe('$0.0040')
    expect(formatCost(0.0008)).toBe('$0.0008')
  })

  it('formats zero', () => {
    expect(formatCost(0)).toBe('$0.00')
  })
})

describe('formatPercent', () => {
  it('converts fraction to percent string', () => {
    expect(formatPercent(0.712)).toBe('71.2%')
    expect(formatPercent(1)).toBe('100.0%')
    expect(formatPercent(0)).toBe('0.0%')
  })
})

describe('formatInt', () => {
  it('adds comma separators', () => {
    expect(formatInt(1_234_567)).toBe('1,234,567')
    expect(formatInt(1000)).toBe('1,000')
    expect(formatInt(999)).toBe('999')
  })
})

describe('formatDelta', () => {
  it('formats positive delta with + prefix', () => {
    expect(formatDelta(0.123)).toBe('+12.3%')
  })

  it('formats negative delta', () => {
    expect(formatDelta(-0.08)).toBe('-8.0%')
  })

  it('returns em-dash for null', () => {
    expect(formatDelta(null)).toBe('—')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    const result = truncate('hello world this is long', 10)
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.endsWith('…')).toBe(true)
  })

  it('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })
})

// ─── date utils ───────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses ISO 8601 dates', () => {
    const d = parseDate('2025-01-15')
    expect(d.getFullYear()).toBe(2025)
    expect(d.getMonth()).toBe(0) // January
    expect(d.getDate()).toBe(15)
  })

  it('parses relative days', () => {
    const d = parseDate('7d')
    const expected = new Date(Date.now() - 7 * 86_400_000)
    expect(d.getDate()).toBe(expected.getDate())
  })

  it('parses relative weeks', () => {
    const d = parseDate('1w')
    const expected = new Date(Date.now() - 7 * 86_400_000)
    expect(d.getDate()).toBe(expected.getDate())
  })

  it('parses relative months', () => {
    const d = parseDate('1m')
    const expected = new Date(Date.now() - 30 * 86_400_000)
    // Allow 1 day tolerance for month boundaries
    const diffDays = Math.abs(d.getTime() - expected.getTime()) / 86_400_000
    expect(diffDays).toBeLessThan(2)
  })

  it("parses 'today'", () => {
    const d = parseDate('today')
    const now = new Date()
    expect(d.getDate()).toBe(now.getDate())
  })

  it('throws on invalid input', () => {
    expect(() => parseDate('not-a-date')).toThrow()
  })
})

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(16 * 3_600_000 + 30 * 60_000)).toBe('16h 30m')
  })

  it('formats minutes only', () => {
    expect(formatDuration(45 * 60_000)).toBe('45m')
  })

  it('formats seconds for short durations', () => {
    expect(formatDuration(30_000)).toBe('30s')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s')
  })
})

describe('dateRange', () => {
  it('returns inclusive range of dates', () => {
    const from = new Date('2025-01-01')
    const to = new Date('2025-01-05')
    const range = dateRange(from, to)
    expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05'])
  })

  it('returns single date for same from/to', () => {
    const d = new Date('2025-03-15')
    expect(dateRange(d, d)).toEqual(['2025-03-15'])
  })
})
