import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeDailyStats } from '../../aggregator/index.js'
import { formatDaily } from '../../format/visual.js'
import { formatDailyJson } from '../../format/json.js'
import { formatDailyCsv } from '../../format/csv.js'
import { formatDailyMarkdown } from '../../format/markdown.js'
import { addFilterFlags, buildRangeLabel } from '../filters.js'
import { getConfig } from '../../config/index.js'

export function registerDailyCommand(program: Command): void {
  const cmd = program.command('daily').description('Show daily usage breakdown').alias('d')

  addFilterFlags(cmd)

  cmd.action(async opts => {
    const config = getConfig()
    const format = opts.format ?? config.defaultFormat ?? 'visual'

    if (!opts.from && config.defaultRange && config.defaultRange !== 'all') {
      opts.from = config.defaultRange
    }

    const filters = buildFilters(opts)
    const db = await getDbAsync(opts.db ?? config.db)
    const events = loadUsageEvents(db, filters)
    const stats = computeDailyStats(events)
    const rangeLabel = buildRangeLabel(opts)

    if (format === 'json') {
      process.stdout.write(formatDailyJson(stats) + '\n')
    } else if (format === 'csv') {
      process.stdout.write(formatDailyCsv(stats) + '\n')
    } else if (format === 'markdown') {
      process.stdout.write(formatDailyMarkdown(stats, rangeLabel) + '\n')
    } else {
      process.stdout.write(formatDaily(stats, rangeLabel))
    }
  })
}
