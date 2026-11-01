import { describe, expect, it } from 'vitest'
import type { User } from '@/types/auth'
import { useAuthStore } from './authStore'

describe('auth store', () => {
  it('keeps the token in localStorage for the API client', () => {
    useAuthStore.getState().setAuth('tok', { id: 'u1' } as User)
    expect(localStorage.getItem('token')).toBe('tok')
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)

    useAuthStore.getState().logout()
    expect(localStorage.getItem('token')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })
})
