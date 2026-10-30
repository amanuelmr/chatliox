import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiWsUrl } from '@/lib/ws'
import type { Conversation } from '@/types/chat'

type DashboardEvent =
  | ({ type: 'conversation_created' | 'conversation_updated' } & Conversation)
  | { type: string }

// Keeps the dashboard conversation list live: upserts conversations into the
// ['conversations'] query cache as they're created or updated, so the list
// no longer depends on polling to reflect new chats or status changes.
export function useDashboardSocket(token: string | null) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!token) return

    let active = true
    let retry: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const ws = new WebSocket(apiWsUrl(`/ws/dashboard?token=${token}`))
      wsRef.current = ws

      ws.onmessage = ({ data }: MessageEvent) => {
        try {
          const e = JSON.parse(data as string) as DashboardEvent
          if (e.type === 'conversation_created' || e.type === 'conversation_updated') {
            const { type: _type, ...conversation } = e as { type: string } & Conversation
            queryClient.setQueryData<Conversation[]>(['conversations'], (prev = []) => {
              const idx = prev.findIndex((c) => c.id === conversation.id)
              if (idx === -1) return [conversation, ...prev]
              const next = [...prev]
              next[idx] = conversation
              return next
            })
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      ws.onclose = () => {
        if (active) retry = setTimeout(connect, 2_000)
      }
    }

    connect()

    return () => {
      active = false
      if (retry) clearTimeout(retry)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [token, queryClient])
}
