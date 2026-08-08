import client from './client'
import type { CannedResponse, CreateCannedResponseRequest, UpdateCannedResponseRequest } from '@/types/cannedResponse'

export const getCannedResponses = (): Promise<CannedResponse[]> =>
  client.get<CannedResponse[]>('/canned-responses').then((r) => r.data)

export const createCannedResponse = (data: CreateCannedResponseRequest): Promise<CannedResponse> =>
  client.post<CannedResponse>('/canned-responses', data).then((r) => r.data)

export const updateCannedResponse = (id: string, data: UpdateCannedResponseRequest): Promise<CannedResponse> =>
  client.patch<CannedResponse>(`/canned-responses/${id}`, data).then((r) => r.data)

export const deleteCannedResponse = (id: string): Promise<void> =>
  client.delete(`/canned-responses/${id}`).then(() => undefined)
