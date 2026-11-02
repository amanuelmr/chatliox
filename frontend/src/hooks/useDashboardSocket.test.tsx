import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { LiveVisitor } from '@/types/visitor'
import { useDashboardSocket } from './useDashboardSocket'

class FakeSocket {
  static latest: FakeSocket
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  constructor() { FakeSocket.latest = this }
  close() {}
}
vi.stubGlobal('WebSocket', FakeSocket)

const emit = (event: Record<string, unknown>) =>
  act(() => FakeSocket.latest.onmessage?.({ data: JSON.stringify(event) }))

const visitor = (visitor_id: string, title: string): LiveVisitor => ({
  visitor_id,
  arrived_at: '2026-11-02T10:00:00Z',
  user_agent: null,
  referrer: null,
  pages: [{ url: `https://shop.test/${title}`, title, at: '2026-11-02T10:00:00Z' }],
})

function connect(visitors?: LiveVisitor[]) {
  const queryClient = new QueryClient()
  if (visitors) queryClient.setQueryData(['visitors'], visitors)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  renderHook(() => useDashboardSocket('token'), { wrapper })
  const titles = () =>
    queryClient.getQueryData<LiveVisitor[]>(['visitors'])?.map((v) => `${v.visitor_id}:${v.pages[0].title}`)
  return titles
}

describe('dashboard socket: live visitors', () => {
  it('keeps the visitor list current as people browse, arrive and leave', async () => {
    const titles = connect([visitor('a', 'Home'), visitor('b', 'Home')])

    await emit({ type: 'visitor_updated', ...visitor('b', 'Pricing') })
    expect(titles()).toEqual(['a:Home', 'b:Pricing'])

    await emit({ type: 'visitor_updated', ...visitor('c', 'Blog') })
    expect(titles()).toEqual(['c:Blog', 'a:Home', 'b:Pricing'])

    await emit({ type: 'visitor_left', visitor_id: 'a' })
    expect(titles()).toEqual(['c:Blog', 'b:Pricing'])
  })

  it('leaves the list to the first fetch when it was never loaded', async () => {
    const titles = connect()
    await emit({ type: 'visitor_updated', ...visitor('a', 'Home') })
    expect(titles()).toBeUndefined()
  })
})
