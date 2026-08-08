export interface DailyVolume {
  date: string
  count: number
}

export interface AgentStat {
  agent_name: string
  resolved_count: number
}

export interface AnalyticsSummary {
  total_conversations: number
  waiting_count: number
  open_count: number
  closed_count: number
  avg_first_response_minutes: number | null
  avg_csat: number | null
  csat_response_count: number
  volume_by_day: DailyVolume[]
  per_agent: AgentStat[]
}
