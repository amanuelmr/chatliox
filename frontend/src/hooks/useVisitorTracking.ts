import { useEffect } from 'react'
import { LOADER_MSG_SOURCE } from '@/lib/embed'
import { apiWsUrl } from '@/lib/ws'

interface PageEvent {
  type: 'page'
  url: string
  title: string
  referrer: string
}

// Passes the pages the loader script reports on to the server, so the team can
// see where visitors are on the site. Runs whether or not a chat has started.
export function useVisitorTracking(widgetKey: string, visitorId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !widgetKey) return

    let active = true
    let retry: ReturnType<typeof setTimeout> | null = null
    let ws: WebSocket | null = null
    // Sent again after a reconnect, so the server never loses track of the current page.
    let current: PageEvent | null = null

    const send = () => {
      if (current && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(current))
    }

    const connect = () => {
      const params = new URLSearchParams({ widget_key: widgetKey, visitor_id: visitorId })
      ws = new WebSocket(apiWsUrl(`/ws/visitors?${params}`))
      ws.onopen = send
      ws.onclose = () => {
        if (active) retry = setTimeout(connect, 5_000)
      }
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as Partial<PageEvent> & { source?: string } | null
      if (!data || data.source !== LOADER_MSG_SOURCE || data.type !== 'page') return
      current = { type: 'page', url: String(data.url ?? ''), title: String(data.title ?? ''), referrer: String(data.referrer ?? '') }
      send()
    }

    window.addEventListener('message', onMessage)
    connect()

    return () => {
      active = false
      if (retry) clearTimeout(retry)
      window.removeEventListener('message', onMessage)
      ws?.close()
    }
  }, [widgetKey, visitorId, enabled])
}
