import type { Command } from 'commander'
import { getDbAsync } from '../../data/db.js'
import { loadUsageEvents, loadSessions } from '../../data/queries.js'
import { buildFilters } from '../../utils/dates.js'
import { computeOverview, computeModelStats, computeProviderStats } from '../../aggregator/index.js'
import { getConfig } from '../../config/index.js'
import { renderModelPanels } from '../../viz/chart.js'
import chalk from 'chalk'

function formatTokens(t: number): string {
  if (t >= 1_000_000_000) return `${(t / 1_000_000_000).toFixed(2)}B`
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M`
  if (t >= 1_000) return `${(t / 1_000).toFixed(2)}K`
  return t.toString()
}

const COLORS = {
  header: chalk.hex('#FFA500'),
  activeTab: chalk.bgHex('#2E7D32').white,
  inactiveTab: chalk.hex('#757575'),
  border: chalk.hex('#424242'),
  label: chalk.hex('#90CAF9'),
  value: chalk.hex('#FFFFFF'),
  highlight: chalk.hex('#4CAF50'),
  warning: chalk.hex('#FFC107'),
  info: chalk.hex('#2196F3'),
  muted: chalk.hex('#9E9E9E'),
}

export function registerTuiCommand(program: Command): void {
  program
    .command('tui')
    .description('Interactive TUI dashboard')
    .action(async () => {
      try {
        const config = getConfig()
        const filters = buildFilters({})
        const db = await getDbAsync(config.db)

        const events = loadUsageEvents(db, filters)
        const sessions = loadSessions(db, filters)
        const overview = computeOverview(events, sessions)
        const modelStats = computeModelStats(events)
        const providerStats = computeProviderStats(events)

        let activeTab = 0
        const tabs = ['Overview', 'Models', 'Providers', 'Sessions']
        let lastLinesDrawn = 0
        let modelsScrollOffset = 0
        const MODELS_PER_PAGE = 3

        // Check if running in a TTY before enabling raw mode
        if (!process.stdin.isTTY) {
          console.error('Error: TUI requires an interactive terminal (TTY).')
          console.error('Try running: taco overview')
          process.exit(1)
        }

        // Enable raw mode for keyboard input
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        // Enable mouse tracking
        process.stdout.write('\x1B[?1000h\x1B[?1002h\x1B[?1005h')

        function clearScreen() {
          if (lastLinesDrawn > 0) {
            process.stdout.write(`\x1B[${lastLinesDrawn}A`)
            process.stdout.write('\x1B[0J')
          }
        }

        function renderTabs() {
          let tabLine = '  '
          tabs.forEach((tab, i) => {
            if (i === activeTab) {
              tabLine += COLORS.activeTab.bold(` ${tab} `)
            } else {
              tabLine += COLORS.inactiveTab(` ${tab} `)
            }
            tabLine += '  '
          })
          return tabLine
        }

        function renderTop3Section(
          title: string,
          items: Array<{ name: string; value: string; detail?: string }>
        ) {
          let content = `${COLORS.label.bold(`${title}:`)}\n`
          items.forEach((item, i) => {
            const num = COLORS.highlight(`${i + 1}.`)
            const detail = item.detail ? ` ${COLORS.muted(item.detail)}` : ''
            content += `  ${num} ${COLORS.value(item.name)} ${COLORS.highlight(item.value)}${detail}\n`
          })
          return content
        }

        function renderCompactModel(model: any, index: number) {
          const percentage = (model.percentage * 100).toFixed(1)
          const color = [COLORS.info, COLORS.highlight, COLORS.warning, COLORS.label][index % 4]

          let content = `${index + 1}. ${color.bold(model.modelId)} ${COLORS.muted(`(${model.providerId})`)} ${COLORS.highlight(percentage + '%')}\n`
          content += `   ${COLORS.label('Tokens:')} ${formatTokens(model.tokens.total)} | `
          content += `${COLORS.label('Cost:')} $${model.cost.toFixed(2)} | `
          content += `${COLORS.label('Msgs:')} ${model.messageCount}\n`
          return content
        }

        function renderContent() {
          let content = ''

          if (activeTab === 0) {
            modelsScrollOffset = 0
            content = `\n${COLORS.label.bold('Overview')}\n\n`

            content += `${COLORS.label('Total Tokens:')}     ${COLORS.highlight(formatTokens(overview.tokens.total))}\n`
            content += `${COLORS.label('Total Sessions:')}   ${COLORS.info(overview.sessionCount.toString())}\n`
            content += `${COLORS.label('Total Cost:')}       ${COLORS.warning('$' + overview.cost.toFixed(4))}\n`
            content += `${COLORS.label('Active Days:')}      ${overview.activedays}/${overview.totalDays}\n`
            content += `${COLORS.label('Current Streak:')}   ${overview.currentStreak} days\n\n`

            if (modelStats.length > 0) {
              const topModels = modelStats.slice(0, 3).map(m => ({
                name: m.modelId.split('/').pop() || m.modelId,
                value: `${(m.percentage * 100).toFixed(1)}%`,
                detail: `(${formatTokens(m.tokens.total)})`,
              }))
              content += renderTop3Section('Top Models', topModels) + '\n'
            }

            if (providerStats.length > 0) {
              const topProviders = providerStats.slice(0, 3).map(p => ({
                name: p.providerId,
                value: `${(p.percentage * 100).toFixed(1)}%`,
                detail: `($${p.cost.toFixed(2)})`,
              }))
              content += renderTop3Section('Top Providers', topProviders) + '\n'
            }

            if (sessions.length > 0) {
              const topSessions = sessions.slice(0, 3).map(s => ({
                name: (s.title || s.id.substring(0, 8)).substring(0, 25),
                value: new Date(s.timeCreated).toLocaleDateString(),
              }))
              content += renderTop3Section('Recent Sessions', topSessions) + '\n'
            }

            content += `${COLORS.label.bold('Token Breakdown:')}\n`
            content += `  ${COLORS.muted('Input:')}      ${formatTokens(overview.tokens.input)}\n`
            content += `  ${COLORS.muted('Output:')}     ${formatTokens(overview.tokens.output)}\n`
            content += `  ${COLORS.muted('Cache Read:')} ${formatTokens(overview.tokens.cacheRead)}\n`
            content += `  ${COLORS.muted('Cache Write:')}${formatTokens(overview.tokens.cacheWrite)}\n`
            content += `  ${COLORS.muted('Reasoning:')}  ${formatTokens(overview.tokens.reasoning)}\n`
          } else if (activeTab === 1) {
            if (modelStats.length === 0) {
              content = `\n${COLORS.label.bold('Models')}\n\nNo model data available.\n`
              modelsScrollOffset = 0
            } else {
              content = `\n${COLORS.label.bold('Models')} ${COLORS.muted(`(showing ${Math.min(modelsScrollOffset + 1, modelStats.length)}-${Math.min(modelsScrollOffset + MODELS_PER_PAGE, modelStats.length)} of ${modelStats.length})`)}\n`
              content += COLORS.muted('Use ↑/↓ arrows to scroll through models\n\n')

              const visibleModels = modelStats.slice(
                modelsScrollOffset,
                modelsScrollOffset + MODELS_PER_PAGE
              )
              const terminalWidth = process.stdout.columns || 80
              const useCompactView = terminalWidth < 100

              if (useCompactView) {
                visibleModels.forEach((m, i) => {
                  content += renderCompactModel(m, modelsScrollOffset + i) + '\n'
                })
              } else {
                const panelLines = renderModelPanels(
                  visibleModels,
                  Math.min(70, terminalWidth - 10),
                  4,
                  true
                )
                content += panelLines.join('\n')
              }

              if (modelStats.length > MODELS_PER_PAGE) {
                content +=
                  '\n' +
                  COLORS.muted(
                    `${modelsScrollOffset > 0 ? '◀ ' : ''}${modelsScrollOffset + 1}-${Math.min(modelsScrollOffset + MODELS_PER_PAGE, modelStats.length)}${modelsScrollOffset + MODELS_PER_PAGE < modelStats.length ? ' ▶' : ''}`
                  )
              }
            }
          } else if (activeTab === 2) {
            modelsScrollOffset = 0
            content = `\n${COLORS.label.bold('Providers')}\n\n`

            if (providerStats.length === 0) {
              content += 'No provider data available.\n'
            } else {
              const maxTokens = providerStats[0]?.tokens.total || 1

              providerStats.forEach((p, i) => {
                const percentage = (p.percentage * 100).toFixed(1)
                const barLength = Math.min(25, Math.floor((p.tokens.total / maxTokens) * 25))
                const bar = '█'.repeat(barLength)
                const num = COLORS.highlight(`${i + 1}.`)
                content += `${num} ${COLORS.value(p.providerId.padEnd(20))} ${COLORS.info(bar)} ${COLORS.highlight(formatTokens(p.tokens.total))} ${COLORS.muted(`(${percentage}%)`)} ${COLORS.warning(`$${p.cost.toFixed(2)}`)}\n`
              })
            }
          } else if (activeTab === 3) {
            modelsScrollOffset = 0
            content = `\n${COLORS.label.bold('Recent Sessions')}\n\n`

            sessions.slice(0, 20).forEach((s, i) => {
              const title = s.title || s.id.substring(0, 8)
              const date = new Date(s.timeCreated).toLocaleDateString()
              const num = COLORS.highlight(`${(i + 1).toString().padStart(2)}.`)
              content += `${num} ${COLORS.value(title.padEnd(40))} ${COLORS.muted(date)}\n`
            })
          }

          return content
        }

        function render() {
          clearScreen()

          const output = [
            COLORS.header.bold('🌮 TACO') + COLORS.label(' — Interactive Dashboard'),
            '',
            renderTabs(),
            COLORS.border('─'.repeat(70)),
            renderContent(),
            COLORS.border('─'.repeat(70)),
            COLORS.muted(
              'Click tabs or press 1-4 to switch | q to quit' +
                (activeTab === 1 ? ' | ↑/↓ to scroll' : '')
            ),
          ].join('\n')

          console.log(output)
          lastLinesDrawn = output.split('\n').length
        }

        console.log('')
        render()

        // Handle input
        process.stdin.on('data', (key: Buffer) => {
          const str = key.toString()
          const code = str.charCodeAt(0)

          // Mouse events: \x1B[M followed by 3 bytes (button, x, y)
          if (
            str.length >= 6 &&
            str.charCodeAt(0) === 27 &&
            str.charCodeAt(1) === 91 &&
            str.charCodeAt(2) === 77
          ) {
            const button = str.charCodeAt(3) - 32
            const x = str.charCodeAt(4) - 32
            const y = str.charCodeAt(5) - 32

            // Left click on tabs (y <= 15 means top area where tabs are)
            if (button === 0 && y <= 15) {
              // Tab positions based on actual rendered positions:
              // "  [ Overview ]  [ Models ]  [ Providers ]  [ Sessions ]"
              // 0123456789012345678901234567890123456789012345678901234
              // Overview: ~2-14, Models: ~14-26, Providers: ~26-40, Sessions: ~40-54
              if (x >= 2 && x < 14) {
                activeTab = 0
                render()
              } else if (x >= 14 && x < 26) {
                activeTab = 1
                render()
              } else if (x >= 26 && x < 40) {
                activeTab = 2
                render()
              } else if (x >= 40 && x < 54) {
                activeTab = 3
                render()
              }
            }
            return
          }

          // Arrow keys for scrolling in models tab
          if (activeTab === 1 && code === 27 && str.length >= 3 && str.charCodeAt(1) === 91) {
            const arrowCode = str.charCodeAt(2)
            if (arrowCode === 65 && modelsScrollOffset > 0) {
              // Up
              modelsScrollOffset--
              render()
              return
            } else if (
              arrowCode === 66 &&
              modelsScrollOffset + MODELS_PER_PAGE < modelStats.length
            ) {
              // Down
              modelsScrollOffset++
              render()
              return
            }
          }

          // Regular keys
          if (str === 'q' || str === '\u0003' || str === '\u001b') {
            clearScreen()
            process.stdout.write('\x1B[?1000l\x1B[?1002l\x1B[?1005l')
            console.log(COLORS.muted('TUI exited.'))
            process.exit(0)
          } else if (str === '1') {
            activeTab = 0
            render()
          } else if (str === '2') {
            activeTab = 1
            render()
          } else if (str === '3') {
            activeTab = 2
            render()
          } else if (str === '4') {
            activeTab = 3
            render()
          }
        })

        process.stdout.on('resize', () => {
          render()
        })
      } catch (err) {
        console.error('TUI Error:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })
}
