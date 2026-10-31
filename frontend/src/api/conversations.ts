import client from './client'
import type { Conversation, ConversationStatus, CreateConversationRequest } from '@/types/chat'

export interface ConversationFilters {
  status?: ConversationStatus
  tag?: string
  q?: string
}

export const getConversations = (filters: ConversationFilters = {}): Promise<Conversation[]> =>
  client.get<Conversation[]>('/conversations', { params: filters }).then((r) => r.data)

export const createConversation = (data: CreateConversationRequest): Promise<Conversation> =>
  client.post<Conversation>('/conversations', data).then((r) => r.data)

export const updateConversationStatus = (id: string, status: ConversationStatus): Promise<Conversation> =>
  client.patch<Conversation>(`/conversations/${id}/status`, { status }).then((r) => r.data)

export const updateConversationTags = (id: string, tags: string[]): Promise<Conversation> =>
  client.patch<Conversation>(`/conversations/${id}/tags`, { tags }).then((r) => r.data)

export const submitCsat = (conversationId: string, visitorId: string, rating: number): Promise<Conversation> =>
  client
    .post<Conversation>(`/conversations/${conversationId}/csat`, { visitor_id: visitorId, rating })
    .then((r) => r.data)

export const getVisitorConversationStatus = (
  conversationId: string,
  visitorId: string,
): Promise<{ status: ConversationStatus; has_email: boolean }> =>
  client.get(`/conversations/${conversationId}/visitor-status`, { params: { visitor_id: visitorId } }).then((r) => r.data)

export const emailTranscript = (conversationId: string): Promise<void> =>
  client.post(`/conversations/${conversationId}/transcript`).then(() => undefined)

// Goes to the email on the conversation; `email` is only used if the visitor never left one.
export const emailVisitorTranscript = (conversationId: string, visitorId: string, email?: string): Promise<void> =>
  client
    .post(`/conversations/${conversationId}/visitor-transcript`, { visitor_id: visitorId, email })
    .then(() => undefined)
