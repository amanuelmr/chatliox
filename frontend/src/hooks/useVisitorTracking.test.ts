import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADER_MSG_SOURCE } from '@/lib/embed'
import { useVisitorTracking } from './useVisitorTracking'

class FakeSocket {
  static all: FakeSocket[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  readyState = 0
  sent: unknown[] = []
  constructor(public url: string) { FakeSocket.all.push(this) }
  send(data: string) { this.sent.push(JSON.parse(data)) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
}
vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }))

const fromLoader = (data: Record<string, unknown>, source: MessageEventSource | null = window.parent) =>
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: { source: LOADER_MSG_SOURCE, ...data }, source })) })

const page = { type: 'page', url: 'https://shop.test/boots', title: 'Boots', referrer: '' }

describe('visitor tracking', () => {
  beforeEach(() => { FakeSocket.all = [] })

  it('passes the pages the loader reports on to the server, once connected', () => {
    renderHook(() => useVisitorTracking('key 1', 'v1', true))
    const ws = FakeSocket.all[0]
    expect(ws.url).toContain('/ws/visitors?widget_key=key+1&visitor_id=v1')

    // Reported before the socket opened: sent as soon as it does.
    fromLoader(page)
    ws.open()
    expect(ws.sent).toEqual([page])

    fromLoader({ ...page, url: 'https://shop.test/cart', title: 'Cart' })
    expect(ws.sent).toHaveLength(2)
  })

  it('ignores messages that are not from the host page', () => {
    renderHook(() => useVisitorTracking('key', 'v1', true))
    FakeSocket.all[0].open()
    fromLoader(page, null)
    fromLoader({ ...page, type: 'visibility' })
    expect(FakeSocket.all[0].sent).toEqual([])
  })

  it('stays off outside an embedded widget', () => {
    renderHook(() => useVisitorTracking('key', 'v1', false))
    expect(FakeSocket.all).toEqual([])
  })
})
