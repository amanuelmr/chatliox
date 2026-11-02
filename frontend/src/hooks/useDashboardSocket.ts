import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiWsUrl } from '@/lib/ws'
import type { Conversation } from '@/types/chat'
import type { LiveVisitor } from '@/types/visitor'

type DashboardEvent =
  | ({ type: 'conversation_created' | 'conversation_updated' } & Conversation)
  | ({ type: 'visitor_updated' } & LiveVisitor)
  | { type: 'visitor_left'; visitor_id: string }
  | { type: string }

// Keeps the dashboard conversation list live: upserts conversations into the
// ['conversations'] query cache as they're created or updated, so the list
// no longer depends on polling to reflect new chats or status changes.
// The live visitor list (['visitors']) is kept current the same way.
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
          } else if (e.type === 'visitor_updated') {
            const { type: _type, ...visitor } = e as { type: string } & LiveVisitor
            queryClient.setQueryData<LiveVisitor[]>(['visitors'], (prev) => {
              if (!prev) return prev
              const idx = prev.findIndex((v) => v.visitor_id === visitor.visitor_id)
              return idx === -1 ? [visitor, ...prev] : prev.map((v, i) => (i === idx ? visitor : v))
            })
          } else if (e.type === 'visitor_left') {
            const { visitor_id } = e as { visitor_id: string }
            queryClient.setQueryData<LiveVisitor[]>(['visitors'], (prev) =>
              prev?.filter((v) => v.visitor_id !== visitor_id),
            )
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      // Visitors who came or went while the socket was down would otherwise be missed.
      ws.onopen = () => queryClient.invalidateQueries({ queryKey: ['visitors'] })

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
