import { useState } from 'react'
import Logo from '@/components/Logo'
import Spinner from '@/components/Spinner'
import { resendVerification } from '@/api/auth'
import { apiErrorMessage } from '@/lib/apiError'
import { useAuthStore } from '@/store/authStore'

export default function VerifyGate({ email }: { email: string }) {
  const logout = useAuthStore((s) => s.logout)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResend = () => {
    setSending(true)
    setError(null)
    resendVerification(email)
      .then(() => setSent(true))
      .catch((err) => setError(apiErrorMessage(err, "We couldn't resend the email. Please try again.")))
      .finally(() => setSending(false))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-4" variant="dark" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900">Verify your email</p>
          <p className="text-sm text-gray-500 mt-1.5">
            We sent a confirmation link to <strong>{email}</strong>. Click it to unlock your dashboard.
          </p>

          {sent ? (
            <p className="mt-5 text-sm text-brand-600 font-medium">Sent — check your inbox</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={sending}
              className="mt-5 w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm rounded-lg py-2.5 transition"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" variant="white" />
                  Sending…
                </span>
              ) : 'Resend email'}
            </button>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={logout}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
