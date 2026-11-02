import type { Conversation, Message } from './chat'

export interface MacroActions {
  add_tags: string[]
  // 'me' assigns whoever runs the macro.
  assign: 'me' | 'unassign' | null
  resolve: boolean
}

// A saved reply. With actions it's a macro: one step that replies, tags, assigns and resolves.
export interface CannedResponse {
  id: string
  title: string
  content: string
  shortcut: string | null
  actions: MacroActions
  use_count: number
  created_at: string
}

export interface CreateCannedResponseRequest {
  title: string
  content: string
  shortcut: string | null
  actions: MacroActions
}

export type UpdateCannedResponseRequest = Partial<CreateCannedResponseRequest>

export interface ApplyMacroResponse {
  conversation: Conversation
  message: Message | null
}
