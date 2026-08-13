import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getMe, verifyEmail } from '@/api/auth'
import Logo from '@/components/Logo'
import { useAuthStore } from '@/store/authStore'

type Status = 'verifying' | 'success' | 'invalid'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [status, setStatus] = useState<Status>('verifying')

  const token = params.get('token') ?? ''

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }
    verifyEmail(token)
      .then(async ({ access_token }) => {
        localStorage.setItem('token', access_token)
        const user = await getMe()
        setAuth(access_token, user)
        setStatus('success')
        setTimeout(() => navigate('/app'), 1500)
      })
      .catch(() => setStatus('invalid'))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-4" variant="dark" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
          {status === 'verifying' && (
            <>
              <div className="w-5 h-5 mx-auto rounded-full border-2 border-zinc-200 border-t-zinc-500 animate-spin" />
              <p className="text-sm text-gray-500 mt-4">Verifying your email…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900">Email verified</p>
              <p className="text-sm text-gray-500 mt-1.5">Taking you to your inbox…</p>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900">Invalid or expired link</p>
              <p className="text-sm text-gray-500 mt-1.5">
                This verification link is invalid or has expired. You can request a new one from your inbox.
              </p>
              <Link to="/login" className="mt-5 inline-block text-sm text-brand-500 font-medium hover:underline">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
