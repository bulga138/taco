import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeTrends } from '../../aggregator/index.js'
import { formatTrends } from '../../format/visual.js'
import { formatTrendsJson } from '../../format/json.js'
import { formatTrendsCsv } from '../../format/csv.js'
import { formatTrendsMarkdown } from '../../format/markdown.js'
import { addFilterFlags, buildRangeLabel } from '../filters.js'
import { getConfig } from '../../config/index.js'
import type { TrendPeriod } from '../../data/types.js'

export function registerTrendsCommand(program: Command): void {
  const cmd = program.command('trends').description('Compare usage across periods').alias('t')

  addFilterFlags(cmd)
    .option('--period <period>', 'Period grouping: day, week, month (default: week)')
    .option('--periods <n>', 'Number of periods to compare (default: 4)')

  cmd.action(async opts => {
    const config = getConfig()
    const format = opts.format ?? config.defaultFormat ?? 'visual'
    const period = (opts.period ?? 'week') as TrendPeriod
    const numPeriods = parseInt(opts.periods ?? '4', 10)

    const filters = buildFilters(opts)
    const db = await getDbAsync(opts.db ?? config.db)

    // Load all events (trends spans backward from today)
    const events = loadUsageEvents(db, filters)
    const stats = computeTrends(events, period, numPeriods)
    const rangeLabel = buildRangeLabel(opts)

    if (format === 'json') {
      process.stdout.write(formatTrendsJson(stats) + '\n')
    } else if (format === 'csv') {
      process.stdout.write(formatTrendsCsv(stats) + '\n')
    } else if (format === 'markdown') {
      process.stdout.write(formatTrendsMarkdown(stats, period, rangeLabel) + '\n')
    } else {
      process.stdout.write(formatTrends(stats, period, rangeLabel))
    }
  })
}
