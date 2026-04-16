/**
 * TACO OpenCode Plugin
 *
 * This module exports a plugin that integrates TACO into the OpenCode TUI.
 * It provides:
 *  - A `taco_stats` custom tool the LLM can call
 *  - A `session.idle` hook for budget alerts
 *
 * Installation in opencode.json:
 *   { "plugin": ["token-accumulator-counter-opencode"] }
 */

// Re-export the tool for use as a standalone custom tool file
export { tacoStatsTool } from './tool.js'

// Plugin function (default export)
export { TacoPlugin as default, TacoPlugin } from './hooks.js'
