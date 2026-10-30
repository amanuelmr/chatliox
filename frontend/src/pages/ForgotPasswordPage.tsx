import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/auth'
import { apiErrorMessage } from '@/lib/apiError'
import Logo from '@/components/Logo'
import Spinner from '@/components/Spinner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // The API answers the same way whether or not the address is registered,
      // so an error here is a real failure (e.g. email not set up), not "unknown account".
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't send the reset email. Please try again."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-4" variant="dark" />
          <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
        </div>

        {sent ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Check your inbox</p>
            <p className="text-sm text-gray-500 mt-1.5">
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
            </p>
            <Link to="/login" className="mt-5 inline-block text-sm text-brand-500 font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col gap-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">
              Enter the email address for your account and we'll send you a link to reset your password.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"
                placeholder="you@company.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm rounded-lg py-2.5 transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" variant="white" />
                  Sending…
                </span>
              ) : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-5">
          Remembered your password?{' '}
          <Link to="/login" className="text-brand-500 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
