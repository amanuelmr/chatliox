export type ConversationStatus = 'open' | 'waiting' | 'closed'
export type SenderType = 'admin' | 'visitor'

export interface Conversation {
  id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: ConversationStatus
  last_message_at: string | null
  created_at: string
  assigned_to_id: string | null
  assigned_to_name: string | null
  // When it started waiting for an agent; null once someone has replied.
  waiting_since: string | null
  tags: string[]
  csat_rating: number | null
  // Answers to the org's custom pre-chat questions, as they were asked.
  pre_chat_answers: { label: string; value: string }[]
  // The pages the visitor moved through while chatting, oldest first.
  visitor_pages: PageView[]
  visitor_user_agent: string | null
  visitor_referrer: string | null
  proactive_message_id: string | null
}

export interface PageView {
  url: string
  title: string
  at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string | null
  sender_name: string | null
  content: string
  is_read: boolean
  is_internal: boolean
  created_at: string
  attachment_url: string | null
  attachment_name: string | null
  attachment_mime: string | null
}

// WebSocket event discriminated union — every frame has a `type` field
export type WsMessageEvent  = Message & { type: 'message' }
export type WsTypingEvent   = {
  type: 'typing'
  user_id: string | null
  sender_type: SenderType
  // The agent's name; null for the visitor.
  name: string | null
  is_typing: boolean
  // What the visitor has typed so far, when the team has typing preview on.
  draft?: string
}
export type WsPresenceEvent = { type: 'presence'; user_id: string; status: 'online' | 'offline' }
export type WsStatusEvent   = { type: 'status';   status: ConversationStatus }
export interface Viewer { user_id: string; name: string }
// Sent only to agents: who has the conversation open right now.
export type WsViewersEvent  = { type: 'viewers';  agents: Viewer[] }
export type WsEvent = WsMessageEvent | WsTypingEvent | WsPresenceEvent | WsStatusEvent | WsViewersEvent

export interface CreateConversationRequest {
  visitor_id: string
  visitor_name?: string
  visitor_email?: string
  widget_key: string
  // Keyed by pre-chat question id.
  pre_chat_answers?: Record<string, string>
  // The proactive message the visitor is answering, if any.
  proactive_message_id?: string
}

export interface CreateMessageRequest {
  conversation_id: string
  content: string
  sender_type: SenderType
  is_internal?: boolean
  // Required when sending as the visitor.
  visitor_id?: string
}
