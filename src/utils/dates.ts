import dayjs from 'dayjs'
import type { QueryFilters } from '../data/types.js'

/**
 * Parse a date string into a Date object.
 * Supports:
 *  - Relative: "7d", "30d", "1w", "3m", "1y"
 *  - ISO 8601: "2025-01-01"
 *  - "today", "yesterday"
 */
export function parseDate(input: string): Date {
  const lower = input.toLowerCase().trim()

  if (lower === 'today') return dayjs().startOf('day').toDate()
  if (lower === 'yesterday') return dayjs().subtract(1, 'day').startOf('day').toDate()

  // Relative: Nd (days), Nw (weeks), Nm (months), Ny (years)
  const relativeMatch = lower.match(/^(\d+)(d|w|m|y)$/)
  if (relativeMatch) {
    const n = parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2] as 'd' | 'w' | 'm' | 'y'
    const unitMap = { d: 'day', w: 'week', m: 'month', y: 'year' } as const
    return dayjs().subtract(n, unitMap[unit]).startOf('day').toDate()
  }

  // ISO 8601
  const parsed = dayjs(input)
  if (!parsed.isValid()) {
    throw new Error(`Invalid date: "${input}". Use ISO 8601 (2025-01-01) or relative (7d, 1w, 3m).`)
  }
  return parsed.toDate()
}

/**
 * Build QueryFilters from CLI option strings.
 */
export function buildFilters(opts: {
  from?: string
  to?: string
  model?: string
  provider?: string
  project?: string
  agent?: string
}): QueryFilters {
  const filters: QueryFilters = {}

  if (opts.from) filters.from = parseDate(opts.from)
  if (opts.to) {
    // "to" date is end-of-day inclusive
    filters.to = dayjs(parseDate(opts.to)).endOf('day').toDate()
  }
  if (opts.model) filters.model = opts.model
  if (opts.provider) filters.provider = opts.provider
  if (opts.project) filters.project = opts.project
  if (opts.agent) filters.agent = opts.agent

  return filters
}

/**
 * Format a Unix epoch ms timestamp as "YYYY-MM-DD".
 */
export function toDateString(ms: number): string {
  return dayjs(ms).format('YYYY-MM-DD')
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * e.g. 59_400_000 → "16h 30m"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

/**
 * Return all YYYY-MM-DD date strings between two dates (inclusive).
 */
export function dateRange(from: Date, to: Date): string[] {
  const dates: string[] = []
  let current = dayjs(from).startOf('day')
  const end = dayjs(to).startOf('day')
  while (!current.isAfter(end)) {
    dates.push(current.format('YYYY-MM-DD'))
    current = current.add(1, 'day')
  }
  return dates
}

/**
 * Return the start date for a relative range string like "30d", "7d", "all".
 */
export function rangeStart(range: string): Date {
  if (range === 'all') return new Date(0)
  return parseDate(range)
}
