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

export function formatOverviewJson(stats: OverviewStats, _heatmap: HeatmapDay[]): string {
  return JSON.stringify(stats, null, 2)
}

export function formatModelsJson(models: ModelStats[]): string {
  return JSON.stringify(models, null, 2)
}

export function formatProvidersJson(providers: ProviderStats[]): string {
  return JSON.stringify(providers, null, 2)
}

export function formatAgentsJson(agents: AgentStats[]): string {
  return JSON.stringify(agents, null, 2)
}

export function formatDailyJson(daily: DailyStats[]): string {
  return JSON.stringify(daily, null, 2)
}

export function formatProjectsJson(projects: ProjectStats[]): string {
  return JSON.stringify(projects, null, 2)
}

export function formatSessionsJson(sessions: SessionStats[]): string {
  return JSON.stringify(sessions, null, 2)
}

export function formatTrendsJson(trends: PeriodStats[]): string {
  return JSON.stringify(trends, null, 2)
}
