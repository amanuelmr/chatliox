import client from './client'
import type {
  ApplyMacroResponse,
  CannedResponse,
  CreateCannedResponseRequest,
  UpdateCannedResponseRequest,
} from '@/types/cannedResponse'

export const getCannedResponses = (): Promise<CannedResponse[]> =>
  client.get<CannedResponse[]>('/canned-responses').then((r) => r.data)

export const createCannedResponse = (data: CreateCannedResponseRequest): Promise<CannedResponse> =>
  client.post<CannedResponse>('/canned-responses', data).then((r) => r.data)

export const updateCannedResponse = (id: string, data: UpdateCannedResponseRequest): Promise<CannedResponse> =>
  client.patch<CannedResponse>(`/canned-responses/${id}`, data).then((r) => r.data)

export const deleteCannedResponse = (id: string): Promise<void> =>
  client.delete(`/canned-responses/${id}`).then(() => undefined)

// Sends the (possibly edited) reply and runs the saved reply's actions on the conversation.
export const applyMacro = (id: string, conversationId: string, content: string): Promise<ApplyMacroResponse> =>
  client
    .post<ApplyMacroResponse>(`/canned-responses/${id}/apply`, { conversation_id: conversationId, content })
    .then((r) => r.data)
