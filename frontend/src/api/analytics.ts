import client from './client'
import type { AnalyticsSummary } from '@/types/analytics'

export const getAnalyticsSummary = (): Promise<AnalyticsSummary> =>
  client.get<AnalyticsSummary>('/analytics/summary').then((r) => r.data)
