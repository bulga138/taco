/**
 * TACO OpenCode Plugin — Event Hooks
 *
 * Hooks into OpenCode events for:
 *  - session.idle: budget alerts after each session
 */

import { getDefaultDbPath, validateDbPath } from '../utils/platform.js'
import { getDb } from '../data/db.js'
import { loadUsageEvents } from '../data/queries.js'
import { getConfig } from '../config/index.js'
import { tacoStatsTool } from './tool.js'

type PluginContext = {
  client: {
    app: {
      log: (args: {
        body: { service: string; level: string; message: string; extra?: Record<string, unknown> }
      }) => Promise<void>
    }
  }
}

type PluginHooks = {
  tool?: Record<string, unknown>
  'session.idle'?: (event: { event: { type: string } }) => Promise<void>
}

/**
 * TacoPlugin — the OpenCode plugin export.
 *
 * Usage in opencode.json:
 *   { "plugin": ["token-accumulator-counter-opencode"] }
 */
export const TacoPlugin = async ({ client }: PluginContext): Promise<PluginHooks> => {
  return {
    // Register the taco_stats custom tool
    tool: {
      taco_stats: tacoStatsTool,
    },

    // Budget alert after each session completes
    'session.idle': async _event => {
      const config = getConfig()
      if (!config.budget) return

      let dbPath: string
      try {
        dbPath = getDefaultDbPath()
        validateDbPath(dbPath)
      } catch {
        return // DB not found — skip silently
      }

      const db = getDb(dbPath)
      const { daily, monthly } = config.budget

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      if (daily !== undefined) {
        const todayEvents = loadUsageEvents(db, { from: todayStart })
        const todayCost = todayEvents.reduce((s, e) => s + e.cost, 0)
        if (todayCost >= daily * 0.8) {
          const pct = ((todayCost / daily) * 100).toFixed(1)
          await client.app.log({
            body: {
              service: 'taco',
              level: todayCost >= daily ? 'error' : 'warn',
              message: `🌮 TACO · Daily budget: $${todayCost.toFixed(2)} / $${daily} (${pct}%)`,
            },
          })
        }
      }

      if (monthly !== undefined) {
        const monthEvents = loadUsageEvents(db, { from: monthStart })
        const monthCost = monthEvents.reduce((s, e) => s + e.cost, 0)
        if (monthCost >= monthly * 0.8) {
          const pct = ((monthCost / monthly) * 100).toFixed(1)
          await client.app.log({
            body: {
              service: 'taco',
              level: monthCost >= monthly ? 'error' : 'warn',
              message: `🌮 TACO · Monthly budget: $${monthCost.toFixed(2)} / $${monthly} (${pct}%)`,
            },
          })
        }
      }
    },
  }
}
