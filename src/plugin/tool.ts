/**
 * taco_stats — Custom tool for OpenCode TUI.
 *
 * The LLM can call this tool to query TACO usage stats.
 * Registered via the plugin system or placed in .opencode/tools/taco_stats.ts
 */

import { getDefaultDbPath, validateDbPath } from '../utils/platform.js'
import { getDb } from '../data/db.js'
import { loadUsageEvents, loadSessions } from '../data/queries.js'
import { buildFilters } from '../utils/dates.js'
import {
  computeOverview,
  computeModelStats,
  computeProviderStats,
  computeDailyStats,
  computeProjectStats,
  computeSessionStats,
  computeAgentStats,
  computeTrends,
  computeHeatmap,
} from '../aggregator/index.js'

import {
  formatOverview,
  formatModels,
  formatProviders,
  formatDaily,
  formatProjects,
  formatSessions,
  formatAgents,
  formatTrends,
} from '../format/visual.js'

export type StatsView =
  | 'overview'
  | 'models'
  | 'providers'
  | 'daily'
  | 'projects'
  | 'sessions'
  | 'agents'
  | 'trends'

export interface StatsArgs {
  view?: StatsView
  from?: string
  to?: string
  model?: string
  provider?: string
  format?: 'visual' | 'json' | 'markdown'
  period?: string
  periods?: number
}

export async function queryStats(args: StatsArgs): Promise<string> {
  const view = args.view ?? 'overview'
  const format = args.format ?? 'markdown'

  const dbPath = getDefaultDbPath()
  try {
    validateDbPath(dbPath)
  } catch (e) {
    return `Error: ${(e as Error).message}`
  }

  const db = getDb(dbPath)
  const filters = buildFilters({
    from: args.from,
    to: args.to,
    model: args.model,
    provider: args.provider,
  })

  const events = loadUsageEvents(db, filters)
  const sessions = loadSessions(db, filters)
  const rangeLabel = `${args.from ?? 'all time'}${args.to ? ' → ' + args.to : ''}`

  switch (view) {
    case 'overview': {
      const heatmapEvents = loadUsageEvents(db)
      const heatmap = computeHeatmap(heatmapEvents)
      const stats = computeOverview(events, sessions)
      const dailyStats = computeDailyStats(events)
      const dailySeries = dailyStats
        .map(d => ({ date: d.date, tokens: d.tokens.total }))
        .sort((a, b) => a.date.localeCompare(b.date))
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatOverview(stats, heatmap, rangeLabel, dailySeries)
      // markdown
      const { formatOverviewMarkdown } = await import('../format/markdown.js')
      return formatOverviewMarkdown(stats, rangeLabel)
    }
    case 'models': {
      const stats = computeModelStats(events)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatModels(stats, rangeLabel)
      const { formatModelsMarkdown } = await import('../format/markdown.js')
      return formatModelsMarkdown(stats, rangeLabel)
    }
    case 'providers': {
      const stats = computeProviderStats(events)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatProviders(stats, rangeLabel)
      const { formatProviderMarkdown } = await import('../format/markdown.js')
      return formatProviderMarkdown(stats, rangeLabel)
    }
    case 'daily': {
      const stats = computeDailyStats(events)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatDaily(stats, rangeLabel)
      const { formatDailyMarkdown } = await import('../format/markdown.js')
      return formatDailyMarkdown(stats, rangeLabel)
    }
    case 'projects': {
      const stats = computeProjectStats(events)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatProjects(stats, rangeLabel)
      const { formatProjectsMarkdown } = await import('../format/markdown.js')
      return formatProjectsMarkdown(stats, rangeLabel)
    }
    case 'sessions': {
      const stats = computeSessionStats(events, sessions)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatSessions(stats, rangeLabel)
      const { formatSessionsMarkdown } = await import('../format/markdown.js')
      return formatSessionsMarkdown(stats, rangeLabel)
    }
    case 'agents': {
      const stats = computeAgentStats(events)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatAgents(stats, rangeLabel)
      const { formatAgentsMarkdown } = await import('../format/markdown.js')
      return formatAgentsMarkdown(stats, rangeLabel)
    }
    case 'trends': {
      const period = (args.period ?? 'week') as 'day' | 'week' | 'month'
      const numPeriods = args.periods ?? 4
      const stats = computeTrends(events, period, numPeriods)
      if (format === 'json') return JSON.stringify(stats, null, 2)
      if (format === 'visual') return formatTrends(stats, period, rangeLabel)
      const { formatTrendsMarkdown } = await import('../format/markdown.js')
      return formatTrendsMarkdown(stats, period, rangeLabel)
    }
    default:
      return `Unknown view: ${view as string}`
  }
}

/**
 * Tool definition compatible with @opencode-ai/plugin's tool() helper.
 * We define it as a plain object so TACO doesn't require the plugin package
 * as a hard dependency.
 */
export const tacoStatsTool = {
  description:
    'Query TACO — Token Accumulator Counter for OpenCode. Returns usage statistics ' +
    '(tokens, costs, sessions) across dates, models, providers, projects, and agents.',
  args: {
    view: {
      type: 'string' as const,
      enum: [
        'overview',
        'models',
        'providers',
        'daily',
        'projects',
        'sessions',
        'agents',
        'trends',
      ],
      default: 'overview',
      description: 'Which stats view to show',
    },
    from: {
      type: 'string' as const,
      description: 'Start date (ISO 8601 like 2025-01-01, or relative like 7d, 30d, 1w, 3m)',
    },
    to: {
      type: 'string' as const,
      description: 'End date',
    },
    model: {
      type: 'string' as const,
      description: 'Filter to a specific model ID',
    },
    provider: {
      type: 'string' as const,
      description: 'Filter to a specific provider ID',
    },
    format: {
      type: 'string' as const,
      enum: ['visual', 'json', 'markdown'],
      default: 'markdown',
      description: 'Output format',
    },
    period: {
      type: 'string' as const,
      enum: ['day', 'week', 'month'],
      default: 'week',
      description: 'Period for trends view',
    },
    periods: {
      type: 'number' as const,
      default: 4,
      description: 'Number of periods for trends view',
    },
  },
  async execute(args: StatsArgs): Promise<string> {
    return queryStats(args)
  },
}
