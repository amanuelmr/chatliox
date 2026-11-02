import client from './client'
import type { LiveVisitor } from '@/types/visitor'

export const getLiveVisitors = (): Promise<LiveVisitor[]> =>
  client.get<LiveVisitor[]>('/visitors').then((r) => r.data)
