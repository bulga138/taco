// Public API surface for programmatic use
export * from './data/types.js'
export * from './aggregator/index.js'
export { getDb, closeDb } from './data/db.js'
export { loadUsageEvents, loadSessions } from './data/queries.js'
export { getConfig } from './config/index.js'

// Plugin exports
export { TacoPlugin, tacoStatsTool } from './plugin/index.js'
