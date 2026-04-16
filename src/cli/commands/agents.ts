import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeAgentStats } from '../../aggregator/index.js'
import { formatAgents } from '../../format/visual.js'
import { formatAgentsJson } from '../../format/json.js'
import { formatAgentsCsv } from '../../format/csv.js'
import { formatAgentsMarkdown } from '../../format/markdown.js'
import { addFilterFlags, buildRangeLabel } from '../filters.js'
import { getConfig } from '../../config/index.js'

export function registerAgentsCommand(program: Command): void {
  const cmd = program
    .command('agents')
    .description('Show per-agent type breakdown (build, plan, explore)')
    .alias('a')

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
    const stats = computeAgentStats(events)
    const rangeLabel = buildRangeLabel(opts)

    if (format === 'json') {
      process.stdout.write(formatAgentsJson(stats) + '\n')
    } else if (format === 'csv') {
      process.stdout.write(formatAgentsCsv(stats) + '\n')
    } else if (format === 'markdown') {
      process.stdout.write(formatAgentsMarkdown(stats, rangeLabel) + '\n')
    } else {
      process.stdout.write(formatAgents(stats, rangeLabel))
    }
  })
}
