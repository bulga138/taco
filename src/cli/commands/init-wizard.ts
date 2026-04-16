import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { getDefaultDbPath } from '../../utils/platform.js'
import { saveConfig, getConfigPath } from '../../config/index.js'
import type { TacoConfig } from '../../config/index.js'

/**
 * Interactive config wizard.  Uses Node.js readline so it works on every
 * platform without extra dependencies.  Every prompt has a sensible default
 * so pressing Enter repeatedly produces a valid config.
 */
export async function runInitWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const ask = (question: string): Promise<string> =>
    new Promise(resolve => rl.question(question, answer => resolve(answer.trim())))

  console.log('\n🌮 TACO — Setup Wizard\n')
  console.log('  This will create a config file at:')
  console.log(`  ${getConfigPath()}\n`)
  console.log('  Press Enter to accept the default (shown in brackets).\n')

  const config: TacoConfig = {}

  // ─── Step 1: Database path ────────────────────────────────────────────
  const detected = getDefaultDbPath()
  const dbExists = existsSync(detected)

  if (dbExists) {
    console.log(`  ✓ OpenCode database detected at: ${detected}`)
    const useDetected = await ask(`  Use this path? [Y/n] `)
    if (useDetected.toLowerCase() === 'n') {
      const custom = await ask('  Enter custom database path: ')
      if (custom) {
        if (!existsSync(custom)) {
          console.log(`  [WARN] Warning: file not found at ${custom}`)
          const proceed = await ask('  Save anyway? [y/N] ')
          if (proceed.toLowerCase() !== 'y') {
            console.log('  Skipped db path.\n')
          } else {
            config.db = custom
          }
        } else {
          config.db = custom
        }
      }
    }
    // If user said Y or Enter, don't set config.db — auto-detection will work
  } else {
    console.log(`  [WARN] No OpenCode database found at default path:`)
    console.log(`    ${detected}\n`)
    const custom = await ask('  Enter database path (or press Enter to skip): ')
    if (custom) {
      config.db = custom
    }
  }

  // ─── Step 2: Default output format ────────────────────────────────────
  console.log('')
  const format = await ask('  Default output format? [visual] / json / csv / markdown: ')
  if (['json', 'csv', 'markdown'].includes(format.toLowerCase())) {
    config.defaultFormat = format.toLowerCase() as TacoConfig['defaultFormat']
  }
  // visual = default, no need to store

  // ─── Step 3: Default date range ───────────────────────────────────────
  const range = await ask('  Default date range? [90d] / 30d / 7d / all: ')
  if (['30d', '7d', 'all'].includes(range.toLowerCase())) {
    config.defaultRange = range.toLowerCase()
  }
  // 90d = default, no need to store

  // ─── Step 4: Budget ───────────────────────────────────────────────────
  console.log('')
  const dailyBudget = await ask('  Daily budget in USD? (press Enter to skip): ')
  if (dailyBudget) {
    const num = parseFloat(dailyBudget)
    if (!isNaN(num) && num > 0) {
      config.budget = { ...config.budget, daily: num }
    } else {
      console.log('  [WARN] Invalid number, skipping daily budget.')
    }
  }

  const monthlyBudget = await ask('  Monthly budget in USD? (press Enter to skip): ')
  if (monthlyBudget) {
    const num = parseFloat(monthlyBudget)
    if (!isNaN(num) && num > 0) {
      config.budget = { ...config.budget, monthly: num }
    } else {
      console.log('  [WARN] Invalid number, skipping monthly budget.')
    }
  }

  // ─── Step 5: Write config ─────────────────────────────────────────────
  rl.close()

  saveConfig(config)

  console.log('\n  [OK] Config saved!\n')
  console.log(`  File: ${getConfigPath()}\n`)

  // Print summary
  const entries = Object.entries(config)
  if (entries.length === 0) {
    console.log('  (all defaults — no custom settings)')
  } else {
    for (const [key, val] of entries) {
      if (typeof val === 'object' && val !== null) {
        for (const [k2, v2] of Object.entries(val as Record<string, unknown>)) {
          console.log(`  ${key}.${k2} = ${v2}`)
        }
      } else {
        console.log(`  ${key} = ${val}`)
      }
    }
  }
  console.log('')
}
