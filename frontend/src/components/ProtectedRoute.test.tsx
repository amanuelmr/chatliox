import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { renderAt } from '@/test/render'
import type { User } from '@/types/auth'
import ProtectedRoute from './ProtectedRoute'

const routes = (
  <Routes>
    <Route path="/login" element={<p>login page</p>} />
    <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<p>inbox</p>} />
    </Route>
  </Routes>
)

describe('ProtectedRoute', () => {
  afterEach(() => useAuthStore.getState().logout())

  it('sends signed-out visitors to the login page', () => {
    renderAt(routes, '/app')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('asks unverified users to verify their email first', () => {
    useAuthStore.getState().setAuth('tok', { email: 'pat@example.com', is_verified: false } as User)
    renderAt(routes, '/app')
    expect(screen.queryByText('inbox')).not.toBeInTheDocument()
    expect(screen.getByText(/pat@example.com/)).toBeInTheDocument()
  })

  it('lets verified users in', () => {
    useAuthStore.getState().setAuth('tok', { email: 'pat@example.com', is_verified: true } as User)
    renderAt(routes, '/app')
    expect(screen.getByText('inbox')).toBeInTheDocument()
  })
})
