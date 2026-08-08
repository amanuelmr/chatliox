export interface CannedResponse {
  id: string
  title: string
  content: string
  created_at: string
}

export interface CreateCannedResponseRequest {
  title: string
  content: string
}

export interface UpdateCannedResponseRequest {
  title?: string
  content?: string
}
