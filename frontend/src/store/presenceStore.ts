import { create } from 'zustand'
import type { Viewer, WsTypingEvent } from '@/types/chat'

type Typist = Pick<WsTypingEvent, 'sender_type' | 'name'>

interface PresenceState {
  onlineUsers: Set<string>
  // Keyed by user id (the visitor id for the visitor).
  typing: Map<string, Typist>
  // Teammates with this conversation open, including the current user.
  viewers: Viewer[]
  setOnline:  (userId: string) => void
  setOffline: (userId: string) => void
  setTyping:  (event: WsTypingEvent) => void
  setViewers: (viewers: Viewer[]) => void
  clear: () => void
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  onlineUsers: new Set(),
  typing: new Map(),
  viewers: [],

  setOnline: (userId) =>
    set((s) => ({ onlineUsers: new Set(s.onlineUsers).add(userId) })),

  setOffline: (userId) =>
    set((s) => {
      const next = new Set(s.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),

  setTyping: ({ user_id, sender_type, name, is_typing }) =>
    set((s) => {
      const next = new Map(s.typing)
      const key = user_id ?? 'visitor'
      is_typing ? next.set(key, { sender_type, name }) : next.delete(key)
      return { typing: next }
    }),

  setViewers: (viewers) =>
    set((s) => {
      // A teammate who closed the chat mid-sentence never sends "stopped typing".
      const ids = new Set(viewers.map((v) => v.user_id))
      const typing = new Map([...s.typing].filter(([id, t]) => t.sender_type !== 'admin' || ids.has(id)))
      return { viewers, typing }
    }),

  clear: () => set({ onlineUsers: new Set(), typing: new Map(), viewers: [] }),
}))
