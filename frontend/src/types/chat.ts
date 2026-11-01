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
  assigned_to_name: string | null
  tags: string[]
  csat_rating: number | null
  // Answers to the org's custom pre-chat questions, as they were asked.
  pre_chat_answers: { label: string; value: string }[]
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
export type WsTypingEvent   = { type: 'typing';   user_id: string | null; is_typing: boolean }
export type WsPresenceEvent = { type: 'presence'; user_id: string; status: 'online' | 'offline' }
export type WsStatusEvent   = { type: 'status';   status: ConversationStatus }
export type WsEvent = WsMessageEvent | WsTypingEvent | WsPresenceEvent | WsStatusEvent

export interface CreateConversationRequest {
  visitor_id: string
  visitor_name?: string
  visitor_email?: string
  widget_key: string
  // Keyed by pre-chat question id.
  pre_chat_answers?: Record<string, string>
}

export interface CreateMessageRequest {
  conversation_id: string
  content: string
  sender_type: SenderType
  is_internal?: boolean
  // Required when sending as the visitor.
  visitor_id?: string
}
