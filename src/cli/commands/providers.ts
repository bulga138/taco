import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeProviderStats } from '../../aggregator/index.js'
import { formatProviders } from '../../format/visual.js'
import { formatProvidersJson } from '../../format/json.js'
import { formatProvidersCsv } from '../../format/csv.js'
import { formatProviderMarkdown } from '../../format/markdown.js'
import { addFilterFlags, buildRangeLabel } from '../filters.js'
import { getConfig } from '../../config/index.js'

export function registerProvidersCommand(program: Command): void {
  const cmd = program
    .command('providers')
    .description('Show per-provider token usage breakdown')
    .alias('p')

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
    const stats = computeProviderStats(events)
    const rangeLabel = buildRangeLabel(opts)

    if (format === 'json') {
      process.stdout.write(formatProvidersJson(stats) + '\n')
    } else if (format === 'csv') {
      process.stdout.write(formatProvidersCsv(stats) + '\n')
    } else if (format === 'markdown') {
      process.stdout.write(formatProviderMarkdown(stats, rangeLabel) + '\n')
    } else {
      process.stdout.write(formatProviders(stats, rangeLabel))
    }
  })
}
