import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeProjectStats } from '../../aggregator/index.js'
import { formatProjects } from '../../format/visual.js'
import { formatProjectsJson } from '../../format/json.js'
import { formatProjectsCsv } from '../../format/csv.js'
import { formatProjectsMarkdown } from '../../format/markdown.js'
import { addFilterFlags, buildRangeLabel } from '../filters.js'
import { getConfig } from '../../config/index.js'

export function registerProjectsCommand(program: Command): void {
  const cmd = program
    .command('projects')
    .description('Show per-project token usage breakdown')
    .alias('proj')

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
    const stats = computeProjectStats(events)
    const rangeLabel = buildRangeLabel(opts)

    if (format === 'json') {
      process.stdout.write(formatProjectsJson(stats) + '\n')
    } else if (format === 'csv') {
      process.stdout.write(formatProjectsCsv(stats) + '\n')
    } else if (format === 'markdown') {
      process.stdout.write(formatProjectsMarkdown(stats, rangeLabel) + '\n')
    } else {
      process.stdout.write(formatProjects(stats, rangeLabel))
    }
  })
}
