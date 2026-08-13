export interface Organization {
  name: string
  widget_key: string
  invite_token: string
  widget_color: string
  widget_greeting: string
}

export type UserRole = 'admin' | 'agent'

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_verified: boolean
  role: UserRole
  created_at: string
  organization: Organization
}

export interface Member {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  org_name: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}
