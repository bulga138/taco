import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

export interface TacoConfig {
  db?: string
  defaultFormat?: 'visual' | 'json' | 'csv' | 'markdown'
  defaultRange?: string
  currency?: string
  budget?: {
    daily?: number
    monthly?: number
  }
}

const CONFIG_PATH = join(homedir(), '.config', 'taco', 'config.json')

let _config: TacoConfig | null = null

export function getConfig(): TacoConfig {
  if (_config !== null) return _config

  if (!existsSync(CONFIG_PATH)) {
    _config = {}
    return _config
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    _config = JSON.parse(raw) as TacoConfig
  } catch {
    console.warn(`[taco] Warning: Could not parse config at ${CONFIG_PATH}`)
    _config = {}
  }

  return _config
}

export function getConfigPath(): string {
  return CONFIG_PATH
}
