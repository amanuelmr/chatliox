import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getMe } from '@/api/auth'
import ErrorBoundary from '@/components/ErrorBoundary'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminDashboard from '@/pages/AdminDashboard'
import ChatPage from '@/pages/ChatPage'
import JoinPage from '@/pages/JoinPage'
import GuidePage from '@/pages/GuidePage'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import WelcomePage from '@/pages/WelcomePage'
import WidgetPage from '@/pages/WidgetPage'
import { useAuthStore } from '@/store/authStore'

export default function App() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const setAuth = useAuthStore((s) => s.setAuth)

  // On mount: verify any persisted token is still valid.
  // getMe() fails → 401 interceptor clears localStorage, logout() clears Zustand.
  useEffect(() => {
    if (!token) return
    getMe()
      .then((user) => setAuth(token, user))
      .catch(() => logout())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/widget" element={<WidgetPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AdminDashboard />} />
          <Route path="/app/c/:id" element={<AdminDashboard />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
