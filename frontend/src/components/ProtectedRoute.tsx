import { Navigate, Outlet } from 'react-router-dom'
import VerifyGate from '@/components/VerifyGate'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  if (!token) return <Navigate to="/login" replace />
  if (user && !user.is_verified) return <VerifyGate email={user.email} />
  return <Outlet />
}
