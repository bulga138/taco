import chalk from 'chalk'
import dayjs from 'dayjs'
import type {
  OverviewStats,
  ModelStats,
  ProviderStats,
  AgentStats,
  DailyStats,
  ProjectStats,
  SessionStats,
  PeriodStats,
} from '../data/types.js'
import type { HeatmapDay } from '../aggregator/index.js'
import type { DailySeries } from '../data/types.js'
import { renderHeatmap } from '../viz/heatmap.js'
import { renderTotalChart, renderModelPanels } from '../viz/chart.js'
import { renderBar, renderDelta } from '../viz/bars.js'
import {
  formatTokens,
  formatCost,
  formatPercent,
  padEnd,
  padStart,
  truncate,
} from '../utils/formatting.js'
import { formatDuration } from '../utils/dates.js'

const useColor = process.stdout.isTTY !== false

// Must match Y_LABEL_WIDTH in chart.ts so stats rows align under chart data area
const Y_OVERVIEW_OFFSET = 10 // 8 (label) + 2 (axis char + space)

function header(title: string): string {
  const prefix = useColor ? chalk.bold.yellow('🌮 TACO') : 'TACO'
  return `\n${prefix} — ${title}\n`
}

function divider(len: number = 56): string {
  return useColor ? chalk.gray('─'.repeat(len)) : '─'.repeat(len)
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export function formatOverview(
  stats: OverviewStats,
  heatmap: HeatmapDay[],
  rangeLabel: string,
  dailySeries?: DailySeries[]
): string {
  const lines: string[] = []

  lines.push(header(`Usage Overview${rangeLabel ? ' · ' + rangeLabel : ''}`))

  // Daily total tokens chart (if we have data)
  if (dailySeries && dailySeries.length > 0) {
    // Chart title
    const dim = (s: string) => (useColor ? chalk.dim(s) : s)
    lines.push(`  ${dim('Tokens / day')}  ${dim('·')}  all models combined`)

    const chartLines = renderTotalChart(dailySeries, 62, 6, useColor)
    lines.push(...chartLines.map(l => '  ' + l))

    // Stats row under the chart: date range, peak day, total
    const sorted = [...dailySeries].sort((a, b) => a.date.localeCompare(b.date))
    const peakDay = dailySeries.reduce((max, d) => (d.tokens > max.tokens ? d : max))
    const firstDate = sorted[0].date
    const lastDate = sorted[sorted.length - 1].date

    const statParts = [
      `${dim('Range:')} ${firstDate} → ${lastDate}`,
      `${dim('Peak:')} ${peakDay.date}  ${formatTokens(peakDay.tokens)}`,
      `${dim('Active days:')} ${dailySeries.length}`,
    ]
    lines.push('  ' + ' '.repeat(Y_OVERVIEW_OFFSET) + statParts.join('   '))
    lines.push('')
  }

  // Heatmap
  lines.push(...renderHeatmap(heatmap, useColor))
  lines.push('')

  lines.push(divider())
  lines.push('')

  const kv = (label: string, value: string, label2?: string, value2?: string): string => {
    const l = padEnd(label + ':', 24)
    // Truncate from start for model names to preserve the actual model name at the end
    const shouldTruncateFromStart = label.toLowerCase().includes('model')
    const v = padEnd(truncate(value, 20, shouldTruncateFromStart), 22)
    if (label2 && value2) {
      return `  ${l} ${v}  ${padEnd(label2 + ':', 24)} ${value2}`
    }
    return `  ${l} ${v}`
  }

  const fav = stats.favoriteModel ?? '—'
  const totalTok = formatTokens(stats.tokens.total)

  lines.push(kv('Favorite model', fav, 'Total tokens', totalTok))
  lines.push(
    kv('Total cost', formatCost(stats.cost), 'Avg cost/day', formatCost(stats.avgCostPerDay))
  )
  lines.push('')
  lines.push(
    kv(
      'Sessions',
      String(stats.sessionCount),
      'Longest session',
      formatDuration(stats.longestSessionMs)
    )
  )
  lines.push(
    kv(
      'Active days',
      `${stats.activedays}/${stats.totalDays}`,
      'Longest streak',
      `${stats.longestStreak} days`
    )
  )
  lines.push(
    kv(
      'Most active day',
      stats.mostActiveDay ?? '—',
      'Current streak',
      `${stats.currentStreak} days`
    )
  )
  lines.push('')
  lines.push(divider())
  lines.push('')

  // Token breakdown
  lines.push('  Token breakdown:')
  lines.push(`    Input:       ${padStart(formatTokens(stats.tokens.input), 10)}`)
  lines.push(`    Output:      ${padStart(formatTokens(stats.tokens.output), 10)}`)
  lines.push(`    Cache read:  ${padStart(formatTokens(stats.tokens.cacheRead), 10)}`)
  lines.push(`    Cache write: ${padStart(formatTokens(stats.tokens.cacheWrite), 10)}`)
  if (stats.tokens.reasoning > 0) {
    lines.push(`    Reasoning:   ${padStart(formatTokens(stats.tokens.reasoning), 10)}`)
  }
  lines.push(`    ─────────────────────`)
  lines.push(`    Total:       ${padStart(formatTokens(stats.tokens.total), 10)}`)
  lines.push(`    Messages:    ${padStart(String(stats.messageCount), 10)}`)
  lines.push('')

  return lines.join('\n')
}

// ─── Models ───────────────────────────────────────────────────────────────────

export function formatModels(models: ModelStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Models${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (models.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  // One panel per model — mini chart + inline stats, shared x-axis
  const panelLines = renderModelPanels(models.slice(0, 6), 62, 4, useColor)
  lines.push(...panelLines)

  return lines.join('\n')
}

// ─── Providers ────────────────────────────────────────────────────────────────

export function formatProviders(providers: ProviderStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Providers${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (providers.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  // Table header
  const colW = { name: 16, tokens: 12, cost: 10, bar: 22, pct: 7 }
  const headerRow = [
    padEnd('Provider', colW.name),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
    padEnd('', colW.bar),
    padStart('Share', colW.pct),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(headerRow) : headerRow))
  lines.push('  ' + divider(headerRow.length))

  for (const p of providers) {
    const row = [
      padEnd(p.providerId, colW.name),
      padStart(formatTokens(p.tokens.total), colW.tokens),
      padStart(formatCost(p.cost), colW.cost),
      renderBar(p.percentage, useColor),
      padStart(formatPercent(p.percentage), colW.pct),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Daily ────────────────────────────────────────────────────────────────────

export function formatDaily(daily: DailyStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Daily Usage${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (daily.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  const colW = { date: 12, sessions: 10, msgs: 10, tokens: 12, cost: 10 }
  const hdr = [
    padEnd('Date', colW.date),
    padStart('Sessions', colW.sessions),
    padStart('Messages', colW.msgs),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(hdr) : hdr))
  lines.push('  ' + divider(hdr.length))

  for (const d of daily) {
    const row = [
      padEnd(d.date, colW.date),
      padStart(String(d.sessionCount), colW.sessions),
      padStart(String(d.messageCount), colW.msgs),
      padStart(formatTokens(d.tokens.total), colW.tokens),
      padStart(formatCost(d.cost), colW.cost),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function formatProjects(projects: ProjectStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Projects${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (projects.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  const colW = { dir: 40, sessions: 10, msgs: 10, tokens: 12, cost: 10 }
  const hdr = [
    padEnd('Project', colW.dir),
    padStart('Sessions', colW.sessions),
    padStart('Messages', colW.msgs),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(hdr) : hdr))
  lines.push('  ' + divider(hdr.length))

  for (const p of projects) {
    const row = [
      padEnd(truncate(p.directory, colW.dir), colW.dir),
      padStart(String(p.sessionCount), colW.sessions),
      padStart(String(p.messageCount), colW.msgs),
      padStart(formatTokens(p.tokens.total), colW.tokens),
      padStart(formatCost(p.cost), colW.cost),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function formatSessions(sessions: SessionStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Sessions${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (sessions.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  const colW = { title: 30, date: 14, msgs: 10, tokens: 12, cost: 10, dur: 12 }
  const hdr = [
    padEnd('Title / ID', colW.title),
    padEnd('Created', colW.date),
    padStart('Msgs', colW.msgs),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
    padStart('Duration', colW.dur),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(hdr) : hdr))
  lines.push('  ' + divider(hdr.length))

  for (const s of sessions) {
    const title = truncate(s.title ?? s.sessionId, colW.title)
    const date = dayjs(s.timeCreated).format('MMM D HH:mm')
    const row = [
      padEnd(title, colW.title),
      padEnd(date, colW.date),
      padStart(String(s.messageCount), colW.msgs),
      padStart(formatTokens(s.tokens.total), colW.tokens),
      padStart(formatCost(s.cost), colW.cost),
      padStart(s.durationMs ? formatDuration(s.durationMs) : '—', colW.dur),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export function formatAgents(agents: AgentStats[], rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Agents${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (agents.length === 0) {
    lines.push('  No data for this period.')
    return lines.join('\n')
  }

  const colW = { agent: 14, msgs: 10, tokens: 12, cost: 10, bar: 22, pct: 7 }
  const hdr = [
    padEnd('Agent', colW.agent),
    padStart('Messages', colW.msgs),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
    padEnd('', colW.bar),
    padStart('Share', colW.pct),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(hdr) : hdr))
  lines.push('  ' + divider(hdr.length))

  for (const a of agents) {
    const row = [
      padEnd(a.agent, colW.agent),
      padStart(String(a.messageCount), colW.msgs),
      padStart(formatTokens(a.tokens.total), colW.tokens),
      padStart(formatCost(a.cost), colW.cost),
      renderBar(a.percentage, useColor),
      padStart(formatPercent(a.percentage), colW.pct),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── Trends ───────────────────────────────────────────────────────────────────

export function formatTrends(trends: PeriodStats[], period: string, rangeLabel: string): string {
  const lines: string[] = []
  lines.push(header(`Trends · ${period}${rangeLabel ? ' · ' + rangeLabel : ''}`))

  if (trends.length === 0) {
    lines.push('  No data.')
    return lines.join('\n')
  }

  const colW = { period: 24, sessions: 10, msgs: 10, tokens: 12, cost: 10, delta: 14 }
  const hdr = [
    padEnd('Period', colW.period),
    padStart('Sessions', colW.sessions),
    padStart('Messages', colW.msgs),
    padStart('Tokens', colW.tokens),
    padStart('Cost', colW.cost),
    padStart('Δ Cost', colW.delta),
  ].join('  ')

  lines.push('  ' + (useColor ? chalk.bold(hdr) : hdr))
  lines.push('  ' + divider(hdr.length))

  for (const t of trends) {
    const row = [
      padEnd(t.label, colW.period),
      padStart(String(t.sessionCount), colW.sessions),
      padStart(String(t.messageCount), colW.msgs),
      padStart(formatTokens(t.tokens.total), colW.tokens),
      padStart(formatCost(t.cost), colW.cost),
      padStart(renderDelta(t.deltaPercent, useColor), colW.delta),
    ].join('  ')
    lines.push('  ' + row)
  }

  lines.push('')
  return lines.join('\n')
}
