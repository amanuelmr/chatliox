import client from './client'
import type { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types/auth'

export const login = (data: LoginRequest): Promise<TokenResponse> =>
  client.post<TokenResponse>('/auth/login', data).then((r) => r.data)

export const register = (data: RegisterRequest): Promise<TokenResponse> =>
  client.post<TokenResponse>('/auth/register', data).then((r) => r.data)

export const getMe = (): Promise<User> =>
  client.get<User>('/auth/me').then((r) => r.data)

export const getInviteInfo = (token: string): Promise<{ org_name: string }> =>
  client.get<{ org_name: string }>(`/auth/invite/${token}`).then((r) => r.data)

export const acceptInvite = (
  token: string,
  data: { email: string; password: string; full_name: string },
): Promise<TokenResponse> =>
  client.post<TokenResponse>(`/auth/invite/${token}`, data).then((r) => r.data)

export const verifyEmail = (token: string): Promise<TokenResponse> =>
  client.post<TokenResponse>('/auth/verify-email', { token }).then((r) => r.data)

export const resendVerification = (email: string): Promise<void> =>
  client.post('/auth/resend-verification', { email }).then(() => undefined)
