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

export const getVisitorConversationStatus = (conversationId: string, visitorId: string): Promise<{ status: ConversationStatus }> =>
  client.get(`/conversations/${conversationId}/visitor-status`, { params: { visitor_id: visitorId } }).then((r) => r.data)
