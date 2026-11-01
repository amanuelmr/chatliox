import client from './client'
import type { CreateMessageRequest, Message } from '@/types/chat'

export const getMessages = (conversationId: string): Promise<Message[]> =>
  client.get<Message[]>(`/conversations/${conversationId}/messages`).then((r) => r.data)

export const getVisitorMessages = (conversationId: string, visitorId: string): Promise<Message[]> =>
  client
    .get<Message[]>(`/conversations/${conversationId}/visitor-messages`, { params: { visitor_id: visitorId } })
    .then((r) => r.data)

export const sendMessage = (data: CreateMessageRequest): Promise<Message> =>
  client.post<Message>('/messages', data).then((r) => r.data)

export interface UploadAttachmentParams {
  conversation_id: string
  sender_type: 'admin' | 'visitor'
  file: File
  is_internal?: boolean
  visitor_id?: string
}

export const uploadAttachment = ({
  conversation_id,
  sender_type,
  file,
  is_internal,
  visitor_id,
}: UploadAttachmentParams): Promise<Message> => {
  const form = new FormData()
  form.append('conversation_id', conversation_id)
  form.append('sender_type', sender_type)
  if (is_internal) form.append('is_internal', 'true')
  if (visitor_id) form.append('visitor_id', visitor_id)
  form.append('file', file)
  return client
    .post<Message>('/messages/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data)
}
